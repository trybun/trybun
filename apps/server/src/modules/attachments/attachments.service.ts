import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Inject, Injectable } from '@nestjs/common';
import {
  type Attachment,
  attachmentActionSchema,
  type AttachmentList,
} from '@trybun/contracts/attachments';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { TRYBUN_CONFIG } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
  quarantineKey,
} from '../../platform/storage/object-storage.js';
import { UsersService } from '../users/users.service.js';
import { contentMatches } from './attachment-content.js';
import { ATTACHMENT, attachmentRuleSelect, CREATE } from './attachments.abilities.js';
import { ATTACHMENT_UPLOADED, type AttachmentUploadedPayload } from './attachments.events.js';
import { allowlistEntryOf, isRasterImage } from './domain/allowlist.js';
import {
  type DraftUsage,
  draftLimitReached,
  draftUsageOf,
  exceedsDraftQuota,
  isDraftQuotaFull,
  remainingDraftBytes,
} from './domain/draft-quota.js';
import { normalizeFileName } from './domain/file-name.js';
import type { QuarantinedFile } from './quarantine-storage.engine.js';

/** The fields of an attachment response and of its rules (§18.3). */
function attachmentSelect(principal: UserPrincipal) {
  return {
    ...attachmentRuleSelect(principal),
    fileName: true,
    contentType: true,
    size: true,
    status: true,
    createdAt: true,
    uploadedBy: { select: { id: true, displayName: true } },
  } satisfies Prisma.AttachmentSelect;
}

type AttachmentRow = Prisma.AttachmentGetPayload<{
  select: ReturnType<typeof attachmentSelect>;
}>;

/** The response shape of an attachment (§18.3) with the actions the principal may perform. */
function toAttachmentResponse(row: AttachmentRow, ability: AppAbility): Attachment {
  const record = subject(ATTACHMENT, row);
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    isImage: isRasterImage(row.contentType),
    status: row.status,
    ticketId: row.ticketId,
    uploadedBy: row.uploadedBy,
    createdAt: row.createdAt.toISOString(),
    allowedActions: attachmentActionSchema.options.filter((action) => ability.can(action, record)),
  };
}

/** The limits of the files of one upload, computed before the first byte is stored. */
export interface UploadLimits {
  /** The size of one file: the configured maximum, or the remaining bytes of the draft quota. */
  maxFileSize: number;
  /** Whether the remaining bytes of the draft quota set `maxFileSize`. */
  isLimitedByQuota: boolean;
}

/** A file whose content matched the allowlist entry of its extension, ready to be inserted. */
type AcceptedFile = Prisma.AttachmentCreateManyInput;

function typeNotAllowed(index: number): AppError {
  return new AppError('attachment.type_not_allowed', [
    { pointer: `/files/${index}`, code: 'field.invalid' },
  ]);
}

/**
 * Attachments (§13.3, ADR 0008): the upload of drafts into quarantine. Each use case is one
 * transaction (§18.3); the objects of the storage are written before it and deleted again when it
 * fails.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly users: UsersService,
    private readonly outbox: OutboxService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig,
  ) {}

  /**
   * The first step of an upload, before its files are received: the principal may upload (`403`
   * otherwise) and has a draft left (`422 attachment.draft_limit_reached`); each file may have the
   * configured size, but no more than the remaining bytes of the draft quota (Q23).
   */
  async uploadLimits(principal: UserPrincipal): Promise<UploadLimits> {
    this.assertMayUpload(this.abilities.forPrincipal(principal));
    const usage = await this.draftUsage(this.prisma, principal.userId);
    if (isDraftQuotaFull(usage)) {
      throw draftLimitReached();
    }
    const remaining = remainingDraftBytes(usage);
    return {
      maxFileSize: Math.min(this.config.attachmentMaxSizeBytes, remaining),
      isLimitedByQuota: remaining < this.config.attachmentMaxSizeBytes,
    };
  }

  /**
   * Creates drafts from the files the storage engine put into quarantine (ADR 0008): each file's
   * content must match the allowlist entry of its extension (`422 attachment.type_not_allowed` at
   * its pointer). The rows in `quarantine` and their outbox events `attachment.uploaded` are
   * written in one transaction under the row lock of the uploader's account, which makes parallel
   * uploads of one person check the draft quota one after the other (Q23). All or nothing (Q6):
   * when anything fails, every object of the request is deleted.
   */
  async upload(
    principal: UserPrincipal,
    files: readonly QuarantinedFile[],
  ): Promise<AttachmentList> {
    try {
      return await this.createDrafts(principal, files);
    } catch (error) {
      await this.deleteObjects(files);
      throw error;
    }
  }

  private async createDrafts(
    principal: UserPrincipal,
    files: readonly QuarantinedFile[],
  ): Promise<AttachmentList> {
    const ability = this.abilities.forPrincipal(principal);
    this.assertMayUpload(ability);
    if (files.length === 0) {
      throw new AppError('request.validation_failed', [
        { pointer: '/files', code: 'array.too_short' },
      ]);
    }
    const accepted: AcceptedFile[] = [];
    for (const [index, file] of files.entries()) {
      accepted.push(await this.accept(principal, file, index));
    }
    return this.prisma.$transaction(async (tx) => {
      if (!(await this.users.lockForUpdate(tx, principal.userId))) {
        throw new AppError('request.not_found');
      }
      const added = {
        count: accepted.length,
        bytes: accepted.reduce((bytes, file) => bytes + file.size, 0),
      };
      if (exceedsDraftQuota(await this.draftUsage(tx, principal.userId), added)) {
        throw draftLimitReached();
      }
      await tx.attachment.createMany({ data: accepted });
      for (const { id } of accepted) {
        const payload = { attachmentId: id } satisfies AttachmentUploadedPayload;
        await this.outbox.add(tx, { type: ATTACHMENT_UPLOADED, payload });
      }
      const ids = accepted.map(({ id }) => id);
      const rows = await tx.attachment.findMany({
        where: { AND: [accessibleBy(ability, 'read').ofType(ATTACHMENT), { id: { in: ids } }] },
        select: attachmentSelect(principal),
      });
      const byId = new Map(rows.map((row) => [row.id, row]));
      return {
        items: ids.flatMap((id) => {
          const row = byId.get(id);
          return row === undefined ? [] : [toAttachmentResponse(row, ability)];
        }),
      };
    });
  }

  /**
   * The row of a stored file whose name and content are allowed (§13.3): the normalized file name,
   * the type of its allowlist entry and the stored size.
   */
  private async accept(
    principal: UserPrincipal,
    file: QuarantinedFile,
    index: number,
  ): Promise<AcceptedFile> {
    const fileName = normalizeFileName(file.originalName);
    const entry = fileName === null ? undefined : allowlistEntryOf(fileName);
    if (fileName === null || entry === undefined) {
      throw typeNotAllowed(index);
    }
    const key = quarantineKey(file.attachmentId);
    if (!(await contentMatches(this.storage, key, file.size, entry))) {
      throw typeNotAllowed(index);
    }
    return {
      id: file.attachmentId,
      fileName,
      contentType: entry.contentType,
      size: file.size,
      uploadedById: principal.userId,
    };
  }

  /** Every account uploads (§7.5); `403` otherwise. */
  private assertMayUpload(ability: AppAbility): void {
    if (!ability.can(CREATE, ATTACHMENT)) {
      throw new AppError('request.forbidden');
    }
  }

  /** The drafts of a user: their number and the bytes of the stored ones (Q23). */
  private async draftUsage(db: Transaction, userId: string): Promise<DraftUsage> {
    const groups = await db.attachment.groupBy({
      by: ['status'],
      where: { uploadedById: userId, ticketId: null },
      _count: { _all: true },
      _sum: { size: true },
    });
    return draftUsageOf(
      groups.map(({ status, _count, _sum }) => ({
        status,
        count: _count._all,
        bytes: _sum.size ?? 0,
      })),
    );
  }

  /**
   * Deletes the objects of a failed upload. A deletion that fails leaves its object to the purge
   * of objects without a row (ADR 0008) and never hides the error of the upload.
   */
  private async deleteObjects(files: readonly QuarantinedFile[]): Promise<void> {
    await Promise.allSettled(
      files.map(({ attachmentId }) => this.storage.delete(quarantineKey(attachmentId))),
    );
  }
}
