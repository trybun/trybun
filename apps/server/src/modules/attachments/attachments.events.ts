import { z } from 'zod';

/**
 * An attachment was uploaded into quarantine (ADR 0008); also written again by the recovery of
 * lost scans (Q10). Its consumer is the scan job.
 */
export const ATTACHMENT_UPLOADED = 'attachment.uploaded';

/** The payload of `attachment.uploaded`: the ID only, never the file name (§18.3). */
export const attachmentUploadedPayloadSchema = z.object({ attachmentId: z.uuid() });
export type AttachmentUploadedPayload = z.infer<typeof attachmentUploadedPayloadSchema>;

/** The scan found the file clean and moved it to `available/` (ADR 0008). Consumed by S1-15. */
export const ATTACHMENT_AVAILABLE = 'attachment.available';

/** The scan found malware; the file is deleted (ADR 0008). S1-15 notifies the uploader (Q8). */
export const ATTACHMENT_INFECTED = 'attachment.infected';

/**
 * The file could not be checked – clamd could not scan it completely, `sharp` could not decode
 * it, its object is gone, or it stayed in quarantine for 24 hours (attachment serving item 2,
 * Q10, Q21); the file is deleted. S1-15 notifies the uploader like for an infected file.
 */
export const ATTACHMENT_REJECTED = 'attachment.rejected';

/**
 * The payload of the outcomes of a scan: the attachment and its uploader, who is notified
 * (§18.3: identifiers only).
 */
export const attachmentScannedPayloadSchema = z.object({
  attachmentId: z.uuid(),
  uploadedById: z.uuid(),
});
export type AttachmentScannedPayload = z.infer<typeof attachmentScannedPayloadSchema>;

/**
 * An attachment row was deleted – by the purge of drafts or through the API. Its consumer deletes
 * both possible objects, the one way objects of a deleted attachment are removed (Rule 12).
 */
export const ATTACHMENT_DELETED = 'attachment.deleted';

/** The payload of `attachment.deleted`. */
export const attachmentDeletedPayloadSchema = z.object({ attachmentId: z.uuid() });
export type AttachmentDeletedPayload = z.infer<typeof attachmentDeletedPayloadSchema>;
