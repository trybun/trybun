import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import { LogContext } from '../../platform/logging/log-context.js';
import { AttachmentPurgeService } from './attachment-purge.service.js';
import { AttachmentScanService } from './attachment-scan.service.js';
import {
  attachmentDeletedPayloadSchema,
  attachmentUploadedPayloadSchema,
} from './attachments.events.js';
import {
  DELETE_ATTACHMENT_OBJECTS_QUEUE,
  PURGE_ATTACHMENTS_QUEUE,
  RECOVER_ATTACHMENT_SCANS_QUEUE,
  SCAN_ATTACHMENT_QUEUE,
} from './attachments.jobs.js';

/** The job data of `attachment.uploaded` (§18.3). */
export const scanAttachmentJobSchema = z.object({ payload: attachmentUploadedPayloadSchema });

/** The job data of `attachment.deleted` (§18.3). */
export const deleteAttachmentObjectsJobSchema = z.object({
  payload: attachmentDeletedPayloadSchema,
});

/** Scans an uploaded file and releases or removes it (ADR 0008). */
@Processor(SCAN_ATTACHMENT_QUEUE)
export class ScanAttachmentProcessor extends WorkerHost {
  constructor(
    private readonly scans: AttachmentScanService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => {
      const { payload } = scanAttachmentJobSchema.parse(job.data);
      return this.scans.scan(payload.attachmentId);
    });
  }
}

/** Deletes both possible objects of a deleted attachment. */
@Processor(DELETE_ATTACHMENT_OBJECTS_QUEUE)
export class DeleteAttachmentObjectsProcessor extends WorkerHost {
  constructor(
    private readonly purge: AttachmentPurgeService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => {
      const { payload } = deleteAttachmentObjectsJobSchema.parse(job.data);
      return this.purge.deleteObjects(payload.attachmentId);
    });
  }
}

/** The recurring recovery of lost scans (Q10). */
@Processor(RECOVER_ATTACHMENT_SCANS_QUEUE)
export class RecoverAttachmentScansProcessor extends WorkerHost {
  constructor(
    private readonly scans: AttachmentScanService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => this.scans.recoverLostScans());
  }
}

/** The recurring purge of drafts and of objects without a row (ADR 0008, Q21). */
@Processor(PURGE_ATTACHMENTS_QUEUE)
export class PurgeAttachmentsProcessor extends WorkerHost {
  constructor(
    private readonly purge: AttachmentPurgeService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => this.purge.purge());
  }
}
