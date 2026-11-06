import { z } from 'zod';
import { pageSchema } from '../pagination/index.js';
import { ticketPersonSchema } from '../tickets/index.js';

/**
 * `attachment.status` (§13.3): `quarantine` until the malware scan has finished, then `available`;
 * an `infected` file and a file that could not be checked completely (`rejected`) are removed.
 */
export const attachmentStatusSchema = z.enum(['quarantine', 'available', 'infected', 'rejected']);
export type AttachmentStatus = z.infer<typeof attachmentStatusSchema>;

/** The action codes of an attachment (§18.3), sent in its `allowedActions`. */
export const attachmentActionSchema = z.enum(['read', 'delete']);
export type AttachmentAction = z.infer<typeof attachmentActionSchema>;

/** The number of files of one upload (§13.3). */
export const MAX_FILES_PER_UPLOAD = 10;

/** The length of a file name after its normalization (§13.3). */
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 255;

/** The number of attachment IDs of one list request (`GET /api/v1/attachments?id=…`). */
export const MAX_ATTACHMENT_IDS_PER_REQUEST = 50;

/** The number of drafts linked by one request (§3.2). */
export const MAX_LINKED_ATTACHMENTS_PER_REQUEST = 100;

/**
 * An attachment (§13.3): its file name, the type of its allowlist entry and its stored size;
 * `isImage` for a raster image, which is shown inline; `ticketId` is `null` for a draft.
 */
export const attachmentSchema = z.object({
  id: z.uuid(),
  fileName: z.string(),
  contentType: z.string(),
  size: z.int().min(0),
  isImage: z.boolean(),
  status: attachmentStatusSchema,
  ticketId: z.uuid().nullable(),
  uploadedBy: ticketPersonSchema,
  createdAt: z.iso.datetime(),
  allowedActions: z.array(attachmentActionSchema),
});
export type Attachment = z.infer<typeof attachmentSchema>;

/** The attachments of an upload or of a link, in the order of the request. */
export const attachmentListSchema = z.object({ items: z.array(attachmentSchema) });
export type AttachmentList = z.infer<typeof attachmentListSchema>;

/** A page of attachments (§18.4). */
export const attachmentPageSchema = pageSchema(attachmentSchema);
export type AttachmentPage = z.infer<typeof attachmentPageSchema>;

/** The path parameters of an attachment. */
export const attachmentParamsSchema = z.object({ attachmentId: z.uuid() });
export type AttachmentParams = z.infer<typeof attachmentParamsSchema>;

/**
 * `GET /api/v1/attachments?id=…&id=…`: the attachments with these IDs the principal can read, a
 * list bounded by the IDs of the request (§18.4). One `id` arrives as a string.
 */
export const listAttachmentsQuerySchema = z.object({
  id: z
    .union([z.uuid().transform((id) => [id]), z.array(z.uuid())])
    .pipe(z.array(z.uuid()).min(1).max(MAX_ATTACHMENT_IDS_PER_REQUEST)),
});
export type ListAttachmentsQuery = z.infer<typeof listAttachmentsQuerySchema>;

/** `POST /api/v1/tickets/{ticketId}/attachments` (§3.2): the principal's own drafts to link. */
export const addTicketAttachmentsSchema = z.strictObject({
  attachmentIds: z.array(z.uuid()).min(1).max(MAX_LINKED_ATTACHMENTS_PER_REQUEST),
});
export type AddTicketAttachmentsDto = z.infer<typeof addTicketAttachmentsSchema>;
