import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';
import { ticketDescriptionSchema, ticketPersonSchema } from '../tickets/index.js';

/**
 * A content revision (§6.1): an earlier version of a comment or of a ticket's description, with
 * the person who wrote it and when. The author is `null` when the reader may not see their name –
 * a customer of another organization, shown as "Customer" (§5.4).
 */
export const contentRevisionSchema = z.object({
  id: z.uuid(),
  /** The text; a person hidden from the reader appears as `@{customer}` (§5.4, S1-12). */
  body: z.string(),
  /** The people the version mentions, as the reader may see them (S1-12 Q2). */
  mentions: z.array(
    z.object({
      id: z.union([z.uuid(), z.literal('customer')]),
      displayName: z.string().nullable(),
    }),
  ),
  author: ticketPersonSchema.nullable(),
  writtenAt: z.iso.datetime(),
});
export type ContentRevision = z.infer<typeof contentRevisionSchema>;

/**
 * `GET /api/v1/comments/{commentId}/revisions` and
 * `GET /api/v1/tickets/{ticketId}/description-revisions`: newest first.
 */
export const listContentRevisionsQuerySchema = pageQuerySchema;
export type ListContentRevisionsQuery = z.infer<typeof listContentRevisionsQuerySchema>;

export const contentRevisionPageSchema = pageSchema(contentRevisionSchema);
export type ContentRevisionPage = z.infer<typeof contentRevisionPageSchema>;

/** The number of revisions one redaction may purge (S1-12 Q19). */
export const MAX_PURGED_REVISIONS = 1000;

/** The revisions a redaction deletes: the UI preselects every revision (S1-12 Q9). */
export const purgeRevisionIdsSchema = z.array(z.uuid()).max(MAX_PURGED_REVISIONS);

/**
 * `POST /api/v1/tickets/{ticketId}/description-redaction` (§6.1): the description that replaces
 * the current one, which is never kept, and the revisions to delete.
 */
export const redactDescriptionSchema = z.strictObject({
  description: ticketDescriptionSchema,
  purgeRevisionIds: purgeRevisionIdsSchema,
});
export type RedactDescriptionDto = z.infer<typeof redactDescriptionSchema>;
