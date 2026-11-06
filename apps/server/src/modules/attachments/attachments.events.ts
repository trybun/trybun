import { z } from 'zod';

/**
 * An attachment was uploaded into quarantine (ADR 0008). The scan of S1-08 step 6 is its consumer;
 * until then the outbox publisher marks it as published.
 */
export const ATTACHMENT_UPLOADED = 'attachment.uploaded';

/** The payload of `attachment.uploaded`: the ID only, never the file name (§18.3). */
export const attachmentUploadedPayloadSchema = z.object({ attachmentId: z.uuid() });
export type AttachmentUploadedPayload = z.infer<typeof attachmentUploadedPayloadSchema>;
