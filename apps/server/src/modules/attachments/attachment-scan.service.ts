import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { Inject, Injectable } from '@nestjs/common';
import type { AttachmentStatus } from '@trybun/contracts/attachments';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { MALWARE_SCANNER, type MalwareScanner } from '../../platform/clamav/malware-scanner.js';
import { Clock } from '../../platform/clock/clock.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';
import { OutboxService } from '../../platform/outbox/outbox.service.js';
import {
  availableKey,
  OBJECT_STORAGE,
  type ObjectStorage,
  quarantineKey,
} from '../../platform/storage/object-storage.js';
import {
  ATTACHMENT_AVAILABLE,
  ATTACHMENT_INFECTED,
  ATTACHMENT_REJECTED,
  ATTACHMENT_UPLOADED,
  type AttachmentScannedPayload,
  type AttachmentUploadedPayload,
} from './attachments.events.js';
import { isRasterImage } from './domain/allowlist.js';
import { lostScanAction, lostScanCutoff } from './domain/attachment-lifetimes.js';
import { imageEncodingOf } from './domain/image-encoding.js';
import { ImageReencoder } from './image-reencoder.js';

/** Rows of one transaction of the recovery (Q10). */
const RECOVERY_BATCH_SIZE = 100;

/** The fields of a row in quarantine the scan needs; never the file name (§13.5). */
interface QuarantinedRow {
  id: string;
  contentType: string;
  uploadedById: string;
}

/** The outcome of a scan: the status it sets and its outbox event. */
type ScanOutcome = Exclude<AttachmentStatus, 'quarantine'>;

const OUTCOME_EVENTS: Record<ScanOutcome, string> = {
  available: ATTACHMENT_AVAILABLE,
  infected: ATTACHMENT_INFECTED,
  rejected: ATTACHMENT_REJECTED,
};

/**
 * Why a file is removed, for the log (§13.5): the ClamAV signature, or the reason it could not be
 * checked.
 */
type RemovalCause = { signature: string } | { reason: 'too_large' | 'undecodable' | 'missing' };

/**
 * What the scan wrote to `available/`: the stored size when it changed (a re-encoded image), or
 * why the file is rejected instead.
 */
type Release =
  | { outcome: 'written'; size?: number }
  | { outcome: 'rejected'; reason: 'too_large' | 'undecodable' };

/**
 * The malware scan of uploads in the Worker (§13.3, ADR 0008 as amended by Q10 and Q21): clean
 * files move from `quarantine/` to `available/` – raster images re-encoded without their metadata
 * – infected and unscannable ones are removed, and lost scans are re-enqueued. Every step is
 * idempotent and changes only a row still in `quarantine`; a scanner or storage failure throws, so
 * BullMQ retries the job and the file stays in quarantine.
 */
@Injectable()
export class AttachmentScanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly clock: Clock,
    private readonly images: ImageReencoder,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(MALWARE_SCANNER) private readonly scanner: MalwareScanner,
    @InjectPinoLogger(AttachmentScanService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Scans the file of an attachment in quarantine. A deleted row ends the job: its
   * `attachment.deleted` job removes the objects. A row no longer in quarantine keeps its status;
   * objects a failed earlier attempt left behind are deleted.
   */
  async scan(attachmentId: string): Promise<void> {
    const row = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, status: true, contentType: true, uploadedById: true },
    });
    if (row === null) {
      return;
    }
    if (row.status !== 'quarantine') {
      await this.deleteLeftovers(row.id, row.status);
      return;
    }
    const content = await this.storage.get(quarantineKey(row.id));
    if (content === null) {
      await this.reconcile(row);
      return;
    }
    const result = await this.scanner.scan(content.body);
    switch (result.verdict) {
      case 'clean':
        await this.release(row);
        return;
      case 'infected':
        await this.remove(row, 'infected', { signature: result.signature });
        return;
      case 'unscannable':
        await this.remove(row, 'rejected', { signature: result.signature });
        return;
    }
  }

  /**
   * Re-enqueues lost scans (Q10), only while clamd answers `PING`, so nothing is enqueued during an
   * outage: every attachment in quarantine unchanged for 15 minutes gets a new outbox event
   * `attachment.uploaded` and a new `updatedAt`, one transaction per batch. A file in quarantine 24
   * hours after its upload is rejected instead.
   */
  async recoverLostScans(): Promise<void> {
    if (!(await this.scanner.ping())) {
      this.logger.warn({ dependency: 'clamav' }, 'Lost attachment scans not re-enqueued');
      return;
    }
    const now = this.clock.now();
    const cutoff = lostScanCutoff(now);
    const counts = { rescanned: 0, rejected: 0 };
    for (;;) {
      const rows = await this.prisma.attachment.findMany({
        where: { status: 'quarantine', updatedAt: { lt: cutoff } },
        select: { id: true, uploadedById: true, createdAt: true },
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        take: RECOVERY_BATCH_SIZE,
      });
      const expired = new Set(
        rows.filter((row) => lostScanAction(row.createdAt, now) === 'reject').map((row) => row.id),
      );
      // The quarantine objects go first: a row left in quarantine without one is rejected by its
      // next scan (Q21), and a scan finishing meanwhile either wins the row or deletes what it
      // wrote.
      await Promise.all([...expired].map((id) => this.storage.delete(quarantineKey(id))));
      await this.prisma.$transaction(async (tx) => {
        for (const row of rows) {
          if (expired.has(row.id)) {
            const { count } = await tx.attachment.updateMany({
              where: { id: row.id, status: 'quarantine' },
              data: { status: 'rejected', updatedAt: now },
            });
            if (count === 1) {
              await this.addOutcomeEvent(tx, row, 'rejected');
              counts.rejected += 1;
            }
            continue;
          }
          const { count } = await tx.attachment.updateMany({
            where: { id: row.id, status: 'quarantine', updatedAt: { lt: cutoff } },
            data: { updatedAt: now },
          });
          if (count === 1) {
            const payload = { attachmentId: row.id } satisfies AttachmentUploadedPayload;
            await this.outbox.add(tx, { type: ATTACHMENT_UPLOADED, payload });
            counts.rescanned += 1;
          }
        }
      });
      if (rows.length < RECOVERY_BATCH_SIZE) {
        break;
      }
    }
    if (counts.rescanned + counts.rejected > 0) {
      this.logger.info(counts, 'Lost attachment scans recovered');
    }
  }

  /**
   * A clean file: written to `available/` – a raster image re-encoded, any other file copied –
   * then the row is set `available` with its event, and only then is the quarantine object
   * deleted (ADR 0008).
   */
  private async release(row: QuarantinedRow): Promise<void> {
    const release = isRasterImage(row.contentType)
      ? await this.writeImage(row)
      : await this.copyFile(row);
    if (release === undefined) {
      return;
    }
    if (release.outcome === 'rejected') {
      await this.remove(row, 'rejected', { reason: release.reason });
      return;
    }
    await this.markAvailable(row, release.size);
    await this.storage.delete(quarantineKey(row.id));
  }

  private async copyFile(row: QuarantinedRow): Promise<Release> {
    await this.storage.copy(quarantineKey(row.id), availableKey(row.id));
    return { outcome: 'written' };
  }

  /**
   * Re-encodes an image into `available/{id}` (Q22: an image above the decoding limit or one
   * `sharp` cannot decode is rejected). Its object was read once by the scanner, so it is read
   * again; when it is gone meanwhile, a duplicate scan or a deletion took it, and the job ends (a
   * row left in quarantine is re-enqueued by the recovery).
   */
  private async writeImage(row: QuarantinedRow): Promise<Release | undefined> {
    const source = await this.storage.get(quarantineKey(row.id));
    if (source === null) {
      return undefined;
    }
    const content = await buffer(source.body);
    const encoding = imageEncodingOf(row.contentType, content);
    if (encoding === undefined) {
      return this.copyFile(row);
    }
    const image = await this.images.reencode(content, encoding);
    if (image.outcome !== 'reencoded') {
      return { outcome: 'rejected', reason: image.outcome };
    }
    await this.storage.put(availableKey(row.id), Readable.from([image.content]));
    return { outcome: 'written', size: image.content.length };
  }

  /**
   * Sets the row `available` – with the stored size when it changed – and writes
   * `attachment.available`, in one transaction.
   */
  private async markAvailable(row: QuarantinedRow, size: number | undefined): Promise<void> {
    const isUpdated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attachment.updateMany({
        where: { id: row.id, status: 'quarantine' },
        data: {
          status: 'available',
          ...(size === undefined ? {} : { size }),
          updatedAt: this.clock.now(),
        },
      });
      if (count === 1) {
        await this.addOutcomeEvent(tx, row, 'available');
      }
      return count === 1;
    });
    if (!isUpdated) {
      await this.deleteLeftoversOfCurrentRow(row.id);
      return;
    }
    this.logger.info({ attachmentId: row.id, status: 'available', size }, 'Attachment scanned');
  }

  /**
   * An infected or unscannable file: the row is set first, together with its event, and the
   * objects are deleted after that (Q21), so a duplicate scan in between finds the row no longer in
   * quarantine. The signature is logged, never the file name (§13.5).
   */
  private async remove(
    row: QuarantinedRow,
    status: Exclude<ScanOutcome, 'available'>,
    cause: RemovalCause,
  ): Promise<void> {
    const isUpdated = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.attachment.updateMany({
        where: { id: row.id, status: 'quarantine' },
        data: { status, updatedAt: this.clock.now() },
      });
      if (count === 1) {
        await this.addOutcomeEvent(tx, row, status);
      }
      return count === 1;
    });
    if (!isUpdated) {
      await this.deleteLeftoversOfCurrentRow(row.id);
      return;
    }
    await this.deleteObjects(row.id);
    this.logger.warn({ attachmentId: row.id, status, ...cause }, 'Attachment removed');
  }

  /**
   * The quarantine object is gone (Q21), e.g. after a restore: a file already in `available/`
   * finishes its move, and a row without any object is rejected.
   */
  private async reconcile(row: QuarantinedRow): Promise<void> {
    const available = await this.storage.head(availableKey(row.id));
    if (available === null) {
      await this.remove(row, 'rejected', { reason: 'missing' });
      return;
    }
    await this.markAvailable(row, available.size);
  }

  /**
   * The row changed while this job ran – deleted, or finished by a duplicate scan or the recovery:
   * what this job wrote is deleted again unless the row is `available`.
   */
  private async deleteLeftoversOfCurrentRow(attachmentId: string): Promise<void> {
    const current = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { status: true },
    });
    await this.deleteLeftovers(attachmentId, current?.status ?? null);
  }

  /**
   * The objects that must not exist for a row whose scan is finished: the quarantine object of an
   * available file, both objects of a removed file or of a deleted row.
   */
  private async deleteLeftovers(
    attachmentId: string,
    status: ScanOutcome | 'quarantine' | null,
  ): Promise<void> {
    if (status === 'available') {
      await this.storage.delete(quarantineKey(attachmentId));
    } else if (status !== 'quarantine') {
      await this.deleteObjects(attachmentId);
    }
  }

  private async deleteObjects(attachmentId: string): Promise<void> {
    await this.storage.delete(quarantineKey(attachmentId));
    await this.storage.delete(availableKey(attachmentId));
  }

  private async addOutcomeEvent(
    tx: Transaction,
    row: Pick<QuarantinedRow, 'id' | 'uploadedById'>,
    status: ScanOutcome,
  ): Promise<void> {
    const payload = {
      attachmentId: row.id,
      uploadedById: row.uploadedById,
    } satisfies AttachmentScannedPayload;
    await this.outbox.add(tx, { type: OUTCOME_EVENTS[status], payload });
  }
}
