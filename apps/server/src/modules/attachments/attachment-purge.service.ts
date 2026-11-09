import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Clock } from '../../platform/clock/clock.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import {
  AVAILABLE_PREFIX,
  availableKey,
  OBJECT_STORAGE,
  type ObjectStorage,
  type ObjectInfo,
  QUARANTINE_PREFIX,
  quarantineKey,
} from '../../platform/storage/object-storage.js';
import { ATTACHMENT_DELETED, type AttachmentDeletedPayload } from './attachments.events.js';
import {
  type AttachmentObject,
  draftPurgeCutoff,
  expiredOrphanObjects,
} from './domain/attachment-lifetimes.js';

/** Rows of one transaction, and objects looked up together. */
const PURGE_BATCH_SIZE = 100;

/** Attachment IDs are UUIDs; any other key under the prefixes has no row. */
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * The purge of the attachment area (§13.3, ADR 0008 as amended by the change specification):
 * drafts are deleted 24 hours after their upload with an outbox event each, whose job deletes
 * their objects; objects without a row are deleted directly after 24 hours (Q21).
 */
@Injectable()
export class AttachmentPurgeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly clock: Clock,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @InjectPinoLogger(AttachmentPurgeService.name) private readonly logger: PinoLogger,
  ) {}

  async purge(): Promise<void> {
    const drafts = await this.purgeDrafts();
    const objects = await this.purgeOrphanObjects();
    if (drafts + objects > 0) {
      this.logger.info({ drafts, objects }, 'Attachments purged');
    }
  }

  /**
   * Deletes both possible objects of a deleted attachment; a missing object is ignored, so the job
   * is idempotent.
   */
  async deleteObjects(attachmentId: string): Promise<void> {
    await this.storage.delete(quarantineKey(attachmentId));
    await this.storage.delete(availableKey(attachmentId));
  }

  /**
   * Deletes drafts linked to nothing 24 hours after their upload, with `attachment.deleted` per
   * row in the same transaction. Each row is deleted only while it is still a draft, so a link made
   * at the same moment wins or fails cleanly (ADR 0008).
   */
  private async purgeDrafts(): Promise<number> {
    const cutoff = draftPurgeCutoff(this.clock.now());
    let purged = 0;
    for (;;) {
      const rows = await this.prisma.attachment.findMany({
        where: { ticketId: null, createdAt: { lt: cutoff } },
        select: { id: true },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: PURGE_BATCH_SIZE,
      });
      purged += await this.prisma.$transaction(async (tx) => {
        let deleted = 0;
        for (const { id } of rows) {
          const { count } = await tx.attachment.deleteMany({ where: { id, ticketId: null } });
          if (count === 1) {
            const payload = { attachmentId: id } satisfies AttachmentDeletedPayload;
            await this.outbox.add(tx, { type: ATTACHMENT_DELETED, payload });
            deleted += 1;
          }
        }
        return deleted;
      });
      if (rows.length < PURGE_BATCH_SIZE) {
        return purged;
      }
    }
  }

  /**
   * Deletes objects under `quarantine/` and `available/` without a row, 24 hours after they were
   * written: left behind by an upload that stopped before its transaction, or brought back by a
   * restore (Q21).
   */
  private async purgeOrphanObjects(): Promise<number> {
    let purged = 0;
    for (const prefix of [QUARANTINE_PREFIX, AVAILABLE_PREFIX]) {
      let batch: AttachmentObject[] = [];
      for await (const object of this.storage.list(prefix)) {
        batch.push(attachmentObjectOf(object, prefix));
        if (batch.length === PURGE_BATCH_SIZE) {
          purged += await this.deleteOrphans(batch);
          batch = [];
        }
      }
      purged += await this.deleteOrphans(batch);
    }
    return purged;
  }

  private async deleteOrphans(objects: readonly AttachmentObject[]): Promise<number> {
    const ids = objects.map(({ attachmentId }) => attachmentId).filter((id) => UUID.test(id));
    const rows =
      ids.length === 0
        ? []
        : await this.prisma.attachment.findMany({
            where: { id: { in: ids } },
            select: { id: true },
          });
    const orphans = expiredOrphanObjects(
      objects,
      new Set(rows.map(({ id }) => id)),
      this.clock.now(),
    );
    for (const { key } of orphans) {
      await this.storage.delete(key);
    }
    return orphans.length;
  }
}

function attachmentObjectOf(object: ObjectInfo, prefix: string): AttachmentObject {
  return {
    key: object.key,
    attachmentId: object.key.slice(prefix.length),
    lastModified: object.lastModified,
  };
}
