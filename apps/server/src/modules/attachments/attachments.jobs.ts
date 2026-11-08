import type { OutboxSubscription } from '../../platform/outbox/outbox.jobs.js';
import { ATTACHMENT_DELETED, ATTACHMENT_UPLOADED } from './attachments.events.js';

/** Queue of the scan of an uploaded file, its move and EXIF stripping (ADR 0008). */
export const SCAN_ATTACHMENT_QUEUE = 'scan-attachment';

/** The consumer of uploads – and of their re-enqueued lost scans (Q10) – that scans the file. */
export const SCAN_ATTACHMENT_SUBSCRIPTION: OutboxSubscription = {
  queue: SCAN_ATTACHMENT_QUEUE,
  eventTypes: [ATTACHMENT_UPLOADED],
};

/** Queue of the job that deletes both possible objects of a deleted attachment. */
export const DELETE_ATTACHMENT_OBJECTS_QUEUE = 'delete-attachment-objects';

/** The consumer of deleted attachments that deletes their objects. */
export const DELETE_ATTACHMENT_OBJECTS_SUBSCRIPTION: OutboxSubscription = {
  queue: DELETE_ATTACHMENT_OBJECTS_QUEUE,
  eventTypes: [ATTACHMENT_DELETED],
};

/**
 * Queue and recurring job (also its scheduler ID) that re-enqueues lost scans while clamd answers
 * and rejects files stuck in quarantine for 24 hours (Q10).
 */
export const RECOVER_ATTACHMENT_SCANS_QUEUE = 'recover-attachment-scans';

/**
 * Queue and recurring job (also its scheduler ID) that purges drafts after 24 hours and objects
 * without a row (ADR 0008, Q21).
 */
export const PURGE_ATTACHMENTS_QUEUE = 'purge-attachments';
