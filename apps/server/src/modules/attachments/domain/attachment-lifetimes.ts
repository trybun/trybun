const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;

/** A scan not finished after 15 minutes in quarantine is taken as lost and re-enqueued (Q10). */
export const LOST_SCAN_AGE_MS = 15 * MINUTE_MS;

/**
 * A file still in quarantine 24 hours after its upload is never released and not rescanned
 * forever: it is rejected (Q10).
 */
export const SCAN_DEADLINE_MS = 24 * HOUR_MS;

/** Drafts linked to nothing are purged 24 hours after their upload (§13.3, ADR 0008). */
export const DRAFT_LIFETIME_MS = 24 * HOUR_MS;

/**
 * Objects without a row are deleted 24 hours after they were written (ADR 0008, Q21): an upload
 * stores its object before it inserts its row, and a restore may bring back objects whose rows
 * were deleted.
 */
export const ORPHAN_OBJECT_AGE_MS = 24 * HOUR_MS;

/** Rows in quarantine whose last change is older than this are lost scans (Q10). */
export function lostScanCutoff(now: Date): Date {
  return new Date(now.getTime() - LOST_SCAN_AGE_MS);
}

/**
 * What the recovery does with a lost scan (Q10): re-enqueue it, or reject the file once it has
 * been in quarantine for 24 hours.
 */
export function lostScanAction(uploadedAt: Date, now: Date): 'rescan' | 'reject' {
  return now.getTime() - uploadedAt.getTime() >= SCAN_DEADLINE_MS ? 'reject' : 'rescan';
}

/** Drafts uploaded before this are purged. */
export function draftPurgeCutoff(now: Date): Date {
  return new Date(now.getTime() - DRAFT_LIFETIME_MS);
}

/** An object of the attachment area, with the attachment ID its key names. */
export interface AttachmentObject {
  key: string;
  attachmentId: string;
  lastModified: Date;
}

/**
 * The objects the purge deletes (ADR 0008, Q21): those without a row, written more than 24 hours
 * ago. A younger object may belong to an upload whose row is not inserted yet.
 */
export function expiredOrphanObjects(
  objects: readonly AttachmentObject[],
  attachmentIdsWithRow: ReadonlySet<string>,
  now: Date,
): AttachmentObject[] {
  const cutoff = now.getTime() - ORPHAN_OBJECT_AGE_MS;
  return objects.filter(
    (object) =>
      !attachmentIdsWithRow.has(object.attachmentId) && object.lastModified.getTime() < cutoff,
  );
}
