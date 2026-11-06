import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { AttachmentPurgeService } from './attachment-purge.service.js';
import { AttachmentScanService } from './attachment-scan.service.js';
import {
  DELETE_ATTACHMENT_OBJECTS_QUEUE,
  PURGE_ATTACHMENTS_QUEUE,
  RECOVER_ATTACHMENT_SCANS_QUEUE,
  SCAN_ATTACHMENT_QUEUE,
} from './attachments.jobs.js';
import {
  DeleteAttachmentObjectsProcessor,
  PurgeAttachmentsProcessor,
  RecoverAttachmentScansProcessor,
  ScanAttachmentProcessor,
} from './attachments.processor.js';
import { ImageReencoder } from './image-reencoder.js';

/** The recovery of lost scans runs every 5 minutes (ADR 0008, Q10). */
export const RECOVER_ATTACHMENT_SCANS_INTERVAL_MS = 5 * 60 * 1_000;

/** The purge runs hourly (ADR 0008). */
export const PURGE_ATTACHMENTS_INTERVAL_MS = 60 * 60 * 1_000;

/**
 * The jobs of attachments (§13.3, ADR 0008), imported only by the Worker: the scan of uploads with
 * the move and EXIF stripping, the deletion of the objects of deleted attachments, the recovery
 * of lost scans and the purge. The object storage and the malware scanner are global platform
 * modules of the Worker.
 */
@Module({
  imports: [
    OutboxModule,
    BullModule.registerQueue(
      { name: SCAN_ATTACHMENT_QUEUE },
      { name: DELETE_ATTACHMENT_OBJECTS_QUEUE },
      { name: RECOVER_ATTACHMENT_SCANS_QUEUE },
      { name: PURGE_ATTACHMENTS_QUEUE },
    ),
  ],
  providers: [
    AttachmentScanService,
    AttachmentPurgeService,
    ImageReencoder,
    ScanAttachmentProcessor,
    DeleteAttachmentObjectsProcessor,
    RecoverAttachmentScansProcessor,
    PurgeAttachmentsProcessor,
  ],
})
export class AttachmentsWorkerModule implements OnApplicationBootstrap {
  constructor(
    @InjectQueue(RECOVER_ATTACHMENT_SCANS_QUEUE) private readonly recoveries: Queue,
    @InjectQueue(PURGE_ATTACHMENTS_QUEUE) private readonly purges: Queue,
  ) {}

  /** One run per interval regardless of the number of Worker replicas (§17.2). */
  async onApplicationBootstrap(): Promise<void> {
    await this.recoveries.upsertJobScheduler(
      RECOVER_ATTACHMENT_SCANS_QUEUE,
      { every: RECOVER_ATTACHMENT_SCANS_INTERVAL_MS },
      { name: RECOVER_ATTACHMENT_SCANS_QUEUE },
    );
    await this.purges.upsertJobScheduler(
      PURGE_ATTACHMENTS_QUEUE,
      { every: PURGE_ATTACHMENTS_INTERVAL_MS },
      { name: PURGE_ATTACHMENTS_QUEUE },
    );
  }
}
