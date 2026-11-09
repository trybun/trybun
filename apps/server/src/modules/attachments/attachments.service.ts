import type { Readable } from 'node:stream';
import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Inject, Injectable } from '@nestjs/common';
import {
  type AddTicketAttachmentsDto,
  type Attachment,
  type AttachmentAction,
  attachmentActionSchema,
  type AttachmentList,
  type AttachmentPage,
  type ListAttachmentsQuery,
  type ListTicketAttachmentsQuery,
} from '@trybun/contracts/attachments';
import { z } from 'zod';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory, type AppAbility } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { TRYBUN_CONFIG } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { decodeCursor, toPage } from '../../platform/database/cursor.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import {
  availableKey,
  OBJECT_STORAGE,
  type ObjectStorage,
  quarantineKey,
} from '../../platform/storage/object-storage.js';
import { ActivityEventsService } from '../activity-events/activity-events.service.js';
import { ProjectsService } from '../projects/projects.service.js';
import { TICKET, ticketRuleSelect } from '../tickets/tickets.abilities.js';
import { identitySelect, visiblePerson } from '../tickets/visible-person.js';
import { UsersService } from '../users/users.service.js';
import { contentMatches } from './attachment-content.js';
import { AttachmentLinksService } from './attachment-links.service.js';
import { ATTACHMENT, attachmentRuleSelect, CREATE, DRAFT } from './attachments.abilities.js';
import {
  ATTACHMENT_DELETED,
  ATTACHMENT_UPLOADED,
  type AttachmentDeletedPayload,
  type AttachmentUploadedPayload,
} from './attachments.events.js';
import { lockAttachmentForUpdate } from './attachments.sql.js';
import { allowlistEntryOf, isRasterImage } from './domain/allowlist.js';
import {
  assertContentAvailable,
  type ConditionalHeaders,
  contentDisposition,
  contentETag,
  isNotModified,
} from './domain/content-response.js';
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
    uploadedBy: { select: identitySelect(principal) },
  } satisfies Prisma.AttachmentSelect;
}

type AttachmentRow = Prisma.AttachmentGetPayload<{
  select: ReturnType<typeof attachmentSelect>;
}>;

/**
 * The response shape of an attachment (§18.3) with the actions the principal may perform; its
 * uploader under the identity rule (§5.4, S1-11 Q9), so a customer of another organization who
 * reads a shared ticket sees "Customer" for its files too.
 */
function toAttachmentResponse(
  row: AttachmentRow,
  ability: AppAbility,
  principal: UserPrincipal,
): Attachment {
  const record = subject(ATTACHMENT, row);
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    isImage: isRasterImage(row.contentType),
    status: row.status,
    ticketId: row.ticketId,
    commentId: row.commentId,
    uploadedBy: visiblePerson(principal, row.uploadedBy),
    createdAt: row.createdAt.toISOString(),
    allowedActions: attachmentActionSchema.options.filter((action) => ability.can(action, record)),
  };
}

/** The attachments of a ticket are listed oldest first (§18.4). */
const creationSortKeySchema = z.tuple([z.iso.datetime(), z.uuid()]);

/**
 * The content of an available attachment (ADR 0008): its ETag and, unless the client's copy is
 * current (`304`), the stream of the object with the headers that describe it.
 */
export interface AttachmentContent {
  etag: string;
  file: {
    body: Readable;
    size: number;
    contentType: string;
    disposition: string;
  } | null;
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
 * Attachments (§13.3, ADR 0008): the upload of drafts into quarantine, reading and downloading,
 * linking drafts to tickets and deleting. Each use case is one transaction (§18.3); the objects of
 * the storage are written before it and deleted again when it fails, and deleted after a deletion
 * through its outbox event.
 */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    private readonly users: UsersService,
    private readonly projects: ProjectsService,
    private readonly activityEvents: ActivityEventsService,
    private readonly links: AttachmentLinksService,
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
      return {
        items: await this.findVisibleInOrder(
          tx,
          ability,
          principal,
          accepted.map(({ id }) => id),
        ),
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

  /** An attachment the target record guard let the principal read. */
  async findOne(principal: UserPrincipal, attachmentId: string): Promise<Attachment> {
    const ability = this.abilities.forPrincipal(principal);
    return toAttachmentResponse(
      await this.findVisible(this.prisma, ability, principal, attachmentId),
      ability,
      principal,
    );
  }

  /**
   * The attachments with the requested IDs the principal can read, in the order of the request
   * (§18.4: a list bounded by the IDs of the request, `nextCursor: null`); unknown and invisible
   * IDs are left out, so nothing is revealed.
   */
  async listByIds(principal: UserPrincipal, query: ListAttachmentsQuery): Promise<AttachmentPage> {
    const ability = this.abilities.forPrincipal(principal);
    const ids = [...new Set(query.id)];
    return {
      items: await this.findVisibleInOrder(this.prisma, ability, principal, ids),
      nextCursor: null,
    };
  }

  /** The attachments of a ticket the target record guard let the principal read, oldest first. */
  async listOfTicket(
    principal: UserPrincipal,
    ticketId: string,
    query: ListTicketAttachmentsQuery,
  ): Promise<AttachmentPage> {
    const ability = this.abilities.forPrincipal(principal);
    const after = decodeCursor(query.cursor, creationSortKeySchema);
    const rows = await this.prisma.attachment.findMany({
      where: {
        AND: [
          accessibleBy(ability, 'read').ofType(ATTACHMENT),
          { ticketId },
          after === null
            ? {}
            : {
                OR: [
                  { createdAt: { gt: new Date(after[0]) } },
                  { createdAt: new Date(after[0]), id: { gt: after[1] } },
                ],
              },
        ],
      },
      select: attachmentSelect(principal),
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: query.limit + 1,
    });
    return toPage(
      rows,
      query.limit,
      (row) => toAttachmentResponse(row, ability, principal),
      (row) => [row.createdAt.toISOString(), row.id],
    );
  }

  /**
   * The content of an attachment the target record guard let the principal read (ADR 0008,
   * attachment serving item 3): `409 attachment.not_available` in quarantine,
   * `410 attachment.removed` once removed – also for an available row whose object is gone after a
   * restore (Q21). A client whose copy is current gets no stream (`304`).
   */
  async content(
    principal: UserPrincipal,
    attachmentId: string,
    conditional: ConditionalHeaders,
  ): Promise<AttachmentContent> {
    const ability = this.abilities.forPrincipal(principal);
    const row = await this.findVisible(this.prisma, ability, principal, attachmentId);
    assertContentAvailable(row.status);
    const etag = contentETag(row.id);
    if (isNotModified(conditional, etag)) {
      return { etag, file: null };
    }
    const content = await this.storage.get(availableKey(row.id));
    if (content === null) {
      throw new AppError('attachment.removed');
    }
    return {
      etag,
      file: {
        body: content.body,
        size: content.size,
        contentType: row.contentType,
        disposition: contentDisposition(row.fileName, isRasterImage(row.contentType)),
      },
    };
  }

  /**
   * Deletes an attachment (§13.3), in one transaction: the row, for a linked attachment the
   * public event `attachment_deleted` with the file's snapshot (Q9), and the outbox event
   * `attachment.deleted`, whose job deletes its objects. The row is locked first, so a concurrent
   * link waits or is seen; a linked attachment then takes the share lock of its project, so a
   * concurrent archive waits or is seen, and the action is checked on the attachment read after
   * both locks.
   */
  async delete(principal: UserPrincipal, attachmentId: string): Promise<void> {
    const ability = this.abilities.forPrincipal(principal);
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockAttachmentForUpdate(tx, attachmentId))) {
        throw new AppError('request.not_found');
      }
      const located = await tx.attachment.findUniqueOrThrow({
        where: { id: attachmentId },
        select: { ticket: { select: { projectId: true } } },
      });
      if (located.ticket !== null) {
        await this.projects.lockForShare(tx, located.ticket.projectId);
      }
      const row = await this.findVisible(tx, ability, principal, attachmentId);
      this.assertCan(ability, 'delete', row);
      await tx.attachment.delete({ where: { id: attachmentId }, select: { id: true } });
      if (row.ticketId !== null) {
        await this.activityEvents.record(tx, { userId: principal.userId }, row.ticketId, [
          {
            type: 'attachment_deleted',
            data: { from: { id: row.id, displayName: row.fileName }, to: null },
            isPublic: true,
          },
        ]);
      }
      const payload = { attachmentId } satisfies AttachmentDeletedPayload;
      await this.outbox.add(tx, { type: ATTACHMENT_DELETED, payload });
    });
  }

  /**
   * Links the principal's own drafts to an existing ticket (§3.2, Q4) with one public event
   * `attachment_added` per file (Q9, Q15); the ticket's version does not change (§17.2). The
   * project of the ticket is locked in share mode, so a concurrent archive waits or is seen, and
   * `add_attachment` is checked on the ticket read after the lock.
   */
  async addToTicket(
    principal: UserPrincipal,
    ticketId: string,
    input: AddTicketAttachmentsDto,
  ): Promise<AttachmentList> {
    const ability = this.abilities.forPrincipal(principal);
    return this.prisma.$transaction(async (tx) => {
      const located = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { projectId: true },
      });
      if (located === null || !(await this.projects.lockForShare(tx, located.projectId))) {
        throw new AppError('request.not_found');
      }
      const ticket = await tx.ticket.findFirst({
        where: { AND: [accessibleBy(ability, 'read').ofType(TICKET), { id: ticketId }] },
        select: ticketRuleSelect(principal),
      });
      if (ticket === null) {
        throw new AppError('request.not_found');
      }
      const ticketRecord = subject(TICKET, ticket);
      if (!ability.can('add_attachment', ticketRecord)) {
        throw new AppError(
          reasonCode(ability.relevantRuleFor('add_attachment', ticketRecord)?.reason),
        );
      }
      const linked = await this.links.linkDrafts(tx, principal, { ticketId }, input.attachmentIds);
      await this.activityEvents.record(
        tx,
        { userId: principal.userId },
        ticketId,
        linked.map(({ id, fileName }) => ({
          type: 'attachment_added' as const,
          data: { from: null, to: { id, displayName: fileName } },
          isPublic: true,
        })),
      );
      return {
        items: await this.findVisibleInOrder(
          tx,
          ability,
          principal,
          linked.map(({ id }) => id),
        ),
      };
    });
  }

  /** An attachment the principal can see, through the `read` filter of the ability: `404` otherwise. */
  private async findVisible(
    db: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    attachmentId: string,
  ): Promise<AttachmentRow> {
    const row = await db.attachment.findFirst({
      where: { AND: [accessibleBy(ability, 'read').ofType(ATTACHMENT), { id: attachmentId }] },
      select: attachmentSelect(principal),
    });
    if (row === null) {
      throw new AppError('request.not_found');
    }
    return row;
  }

  /** The attachments with these IDs the principal can see, in the order of the IDs. */
  private async findVisibleInOrder(
    db: Transaction,
    ability: AppAbility,
    principal: UserPrincipal,
    ids: readonly string[],
  ): Promise<Attachment[]> {
    const rows = await db.attachment.findMany({
      where: { AND: [accessibleBy(ability, 'read').ofType(ATTACHMENT), { id: { in: [...ids] } }] },
      select: attachmentSelect(principal),
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return ids.flatMap((id) => {
      const row = byId.get(id);
      return row === undefined ? [] : [toAttachmentResponse(row, ability, principal)];
    });
  }

  /** `403`, or the code of the denying rule (e.g. `409 project.archived`). */
  private assertCan(ability: AppAbility, action: AttachmentAction, row: AttachmentRow): void {
    const record = subject(ATTACHMENT, row);
    if (!ability.can(action, record)) {
      throw new AppError(reasonCode(ability.relevantRuleFor(action, record)?.reason));
    }
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
      where: { uploadedById: userId, ...DRAFT },
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
