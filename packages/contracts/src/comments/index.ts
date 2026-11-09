import { z } from 'zod';
import { activityEventResponseSchema } from '../activity-events/index.js';
import { attachmentSchema } from '../attachments/index.js';
import { purgeRevisionIdsSchema } from '../content-revisions/index.js';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';
import {
  MAX_LINKED_ATTACHMENTS_PER_REQUEST,
  ticketPersonSchema,
  ticketVisibilitySchema,
} from '../tickets/index.js';

/**
 * `comment.kind` (§6.1): a `public` comment, which end users in its audience see, or an
 * `internal` note, which only the team sees. Set at creation, never changed (S1-12 Q12).
 */
export const commentKindSchema = z.enum(['public', 'internal']);
export type CommentKind = z.infer<typeof commentKindSchema>;

/**
 * The action codes of a comment (§18.3), sent in its `allowedActions`: `update` edits the own
 * text, `delete` removes it, `redact` replaces its text and purges revisions (team), and
 * `read_revisions` lists its earlier versions.
 */
export const commentActionSchema = z.enum(['read', 'update', 'delete', 'redact', 'read_revisions']);
export type CommentAction = z.infer<typeof commentActionSchema>;

/** The text of a comment: GFM Markdown, trimmed, 1–65,536 characters (S1-12 Q19). */
export const COMMENT_BODY_MAX_LENGTH = 65_536;
export const commentBodySchema = z.string().trim().min(1).max(COMMENT_BODY_MAX_LENGTH);

/** The number of distinct people one text may mention (S1-12 Q19, GitHub's limit). */
export const MAX_MENTIONS_PER_TEXT = 50;

/** The number of people one mention search returns (S1-12 Q19). */
export const MAX_MENTION_CANDIDATES = 10;

/** The length of the text typed after `@` in a mention search (S1-12). */
export const MENTION_QUERY_MAX_LENGTH = 100;

/**
 * The ID that stands for a mentioned person the reader may not see (§5.4): their token reaches the
 * reader as `@{customer}`, so no hidden user ID leaves the server.
 */
export const HIDDEN_MENTION_ID = 'customer';

/**
 * A mentioned person as the reader may see them (§5.4): their ID and display name, or the entry
 * `{ id: 'customer', displayName: 'Customer' }` for every person hidden from the reader.
 */
export const commentMentionSchema = z.object({
  id: z.union([z.uuid(), z.literal(HIDDEN_MENTION_ID)]),
  displayName: z.string().nullable(),
});
export type CommentMention = z.infer<typeof commentMentionSchema>;

/**
 * `POST /api/v1/tickets/{ticketId}/comments` (§6.1): the kind (end users send only `public`), the
 * text and the principal's own draft attachments to link to the comment.
 */
export const createCommentSchema = z.strictObject({
  kind: commentKindSchema,
  body: commentBodySchema,
  attachmentIds: z.array(z.uuid()).max(MAX_LINKED_ATTACHMENTS_PER_REQUEST).optional(),
});
export type CreateCommentDto = z.infer<typeof createCommentSchema>;

/** `PATCH /api/v1/comments/{commentId}` (§6.1): the new text and further own drafts to link. */
export const updateCommentSchema = z.strictObject({
  body: commentBodySchema,
  attachmentIds: z.array(z.uuid()).max(MAX_LINKED_ATTACHMENTS_PER_REQUEST).optional(),
});
export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;

/**
 * `POST /api/v1/comments/{commentId}/redaction` (§6.1): the text that replaces the current one,
 * which is never kept, and the revisions to delete.
 */
export const redactCommentSchema = z.strictObject({
  body: commentBodySchema,
  purgeRevisionIds: purgeRevisionIdsSchema,
});
export type RedactCommentDto = z.infer<typeof redactCommentSchema>;

/**
 * `POST /api/v1/tickets/{ticketId}/mention-candidates` (§7.3): the kind of the comment being
 * written and the text typed after `@`, in the body because it is free text (§17.2).
 */
export const mentionCandidatesSchema = z.strictObject({
  kind: commentKindSchema,
  query: z.string().trim().max(MENTION_QUERY_MAX_LENGTH),
});
export type MentionCandidatesDto = z.infer<typeof mentionCandidatesSchema>;

/** A person a comment may mention, team members first (§7.3). */
export const mentionCandidateSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  userKind: z.enum(['team', 'end_user']),
});
export type MentionCandidate = z.infer<typeof mentionCandidateSchema>;

export const mentionCandidatePageSchema = pageSchema(mentionCandidateSchema);
export type MentionCandidatePage = z.infer<typeof mentionCandidatePageSchema>;

/** The fields of a comment every reader sees (§6.1). */
const commonCommentFields = {
  id: z.uuid(),
  ticketId: z.uuid(),
  /** The author; `null` when the reader may not see their name (§5.4). */
  author: ticketPersonSchema.nullable(),
  body: z.string(),
  mentions: z.array(commentMentionSchema),
  attachments: z.array(attachmentSchema),
  /** The time of the last edit or redaction; the UI shows "edited" (§6.1). */
  editedAt: z.iso.datetime().nullable(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  allowedActions: z.array(commentActionSchema),
};

/**
 * A comment as the team sees it: its kind and, for a public comment, its audience – the
 * visibility of the ticket when it was written, with the organization of `my_organization` (§5.2).
 */
export const commentSchema = z.object({
  ...commonCommentFields,
  kind: commentKindSchema,
  audience: ticketVisibilitySchema.nullable(),
  audienceOrganization: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});
export type Comment = z.infer<typeof commentSchema>;

/** A comment as an end user sees it: always public, without its audience (§5.2). */
export const endUserCommentSchema = z.object(commonCommentFields);
export type EndUserComment = z.infer<typeof endUserCommentSchema>;

/**
 * The response of a comment: the team's shape for team accounts, the end user's for end users. The
 * serializer keeps only the fields of the matching shape.
 */
export const commentResponseSchema = z.union([commentSchema, endUserCommentSchema]);
export type CommentResponse = z.infer<typeof commentResponseSchema>;

/** The path parameters of a comment. */
export const commentParamsSchema = z.object({ commentId: z.uuid() });
export type CommentParams = z.infer<typeof commentParamsSchema>;

/** `GET /api/v1/tickets/{ticketId}/comments`: oldest first. */
export const listCommentsQuerySchema = pageQuerySchema;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;

export const commentPageSchema = pageSchema(commentResponseSchema);
export type CommentPage = z.infer<typeof commentPageSchema>;

/**
 * An item of a ticket's timeline (S1-12 Q11): a comment or an activity event, merged in the order
 * of their time-ordered IDs.
 */
export const timelineItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('comment'), comment: commentResponseSchema }),
  z.object({ type: z.literal('event'), event: activityEventResponseSchema }),
]);
export type TimelineItem = z.infer<typeof timelineItemSchema>;

/** `GET /api/v1/tickets/{ticketId}/timeline`: comments and events, oldest first. */
export const listTimelineQuerySchema = pageQuerySchema;
export type ListTimelineQuery = z.infer<typeof listTimelineQuerySchema>;

export const timelinePageSchema = pageSchema(timelineItemSchema);
export type TimelinePage = z.infer<typeof timelinePageSchema>;
