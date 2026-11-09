import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';
import { ticketPublicStatusSchema } from '../tickets/index.js';

/**
 * `activity_event.type` (§4.5): one event per changed field of a ticket, the events of its
 * status (S1-06) – a status change, the re-pointing and the removal of a duplicate's link, and a
 * new rejection reason (without its text) – a file added to or deleted from an existing ticket
 * (S1-08), and the visibility changes and sharing decisions (S1-11): only `sharing_approved` is
 * public, and no event holds the refusal reason. The edit, deletion and redaction of a comment
 * and the redaction of a description are internal and hold no content (S1-12 Q6, Q7). Later tasks
 * add theirs.
 */
export const activityEventTypeSchema = z.enum([
  'title_changed',
  'description_edited',
  'type_changed',
  'priority_changed',
  'assignee_changed',
  'status_changed',
  'duplicate_original_changed',
  'duplicate_link_removed',
  'rejection_reason_changed',
  'attachment_added',
  'attachment_deleted',
  'visibility_changed',
  'sharing_requested',
  'sharing_request_withdrawn',
  'sharing_approved',
  'sharing_rejected',
  'comment_edited',
  'comment_deleted',
  'comment_redacted',
  'description_redacted',
]);
export type ActivityEventType = z.infer<typeof activityEventTypeSchema>;

/**
 * `activity_event.automatic_source` (§4.5): who made an automatic change – `system` for the rules
 * of the system, e.g. the unassignment of a deactivated person. Later `github`, `integration`.
 */
export const activityEventSourceSchema = z.enum(['system']);
export type ActivityEventSource = z.infer<typeof activityEventSourceSchema>;

/**
 * A reference stored in an event as a snapshot (§4.5): the record's ID and its name at the time of
 * the change, so the history stays readable after a rename.
 */
export const activityEventSnapshotSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
});
export type ActivityEventSnapshot = z.infer<typeof activityEventSnapshotSchema>;

/**
 * A ticket stored in an event as a snapshot (§4.5), e.g. the original of a duplicate: its ID and
 * its identifier parts at the time of the change.
 */
export const activityEventTicketSnapshotSchema = z.object({
  id: z.uuid(),
  number: z.int().min(1),
  projectKey: z.string(),
});
export type ActivityEventTicketSnapshot = z.infer<typeof activityEventTicketSnapshotSchema>;

/**
 * A value of a change: an enum code (a status is stored as its code, its label comes from the
 * catalogues), a text, a snapshot of a person or a ticket, or none.
 */
export const activityEventValueSchema = z.union([
  z.string(),
  activityEventSnapshotSchema,
  activityEventTicketSnapshotSchema,
  z.null(),
]);
export type ActivityEventValue = z.infer<typeof activityEventValueSchema>;

/**
 * The previous and the new value of a field; absent for `description_edited` and
 * `rejection_reason_changed`. A `status_changed` event adds whether it reopened the ticket, the
 * waiting reason of the new status and the original of a new duplicate.
 */
export const activityEventChangeDataSchema = z.object({
  from: activityEventValueSchema,
  to: activityEventValueSchema,
  reopen: z.boolean().optional(),
  waitingReason: z.string().nullable().optional(),
  duplicateOf: activityEventTicketSnapshotSchema.nullable().optional(),
});
export type ActivityEventChangeData = z.infer<typeof activityEventChangeDataSchema>;

/**
 * The data of an event about a comment (`comment_edited`, `comment_deleted`, `comment_redacted`,
 * S1-12): only the comment's ID and, for a deletion, its kind – never its text or author (Q7).
 */
export const activityEventCommentDataSchema = z.object({
  commentId: z.uuid(),
  kind: z.enum(['public', 'internal']).optional(),
});
export type ActivityEventCommentData = z.infer<typeof activityEventCommentDataSchema>;

/** The data of an event: a change of a value, or a reference to a comment. */
export const activityEventDataSchema = z.union([
  activityEventChangeDataSchema,
  activityEventCommentDataSchema,
]);
export type ActivityEventData = z.infer<typeof activityEventDataSchema>;

/**
 * An activity event of a ticket (§4.5): immutable. The actor's name is read at read time; the
 * snapshots in `data` keep the name at the time of the change. An automatic event has no actor.
 */
export const activityEventSchema = z.object({
  id: z.uuid(),
  type: activityEventTypeSchema,
  data: activityEventDataSchema.nullable(),
  actor: z.object({ id: z.uuid(), displayName: z.string().nullable() }).nullable(),
  automaticSource: activityEventSourceSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type ActivityEvent = z.infer<typeof activityEventSchema>;

/**
 * The data of a public status change as an end user sees it (Q11): the previous and the new
 * **public** status, and the original of a new duplicate only when the reader may read it (§3.5);
 * whether it reopened the ticket, the waiting reason and the internal statuses are left out.
 */
export const endUserStatusChangeDataSchema = z.object({
  from: ticketPublicStatusSchema,
  to: ticketPublicStatusSchema,
  duplicateOf: activityEventTicketSnapshotSchema.nullable().optional(),
});

/**
 * The data of a file added to or deleted from a ticket (`attachment_added`, `attachment_deleted`,
 * S1-08 Q15): the snapshot of the file with its name, as for the team – the name is visible to
 * everyone who sees the ticket's attachments.
 */
export const endUserSnapshotChangeDataSchema = z.object({
  from: activityEventSnapshotSchema.nullable(),
  to: activityEventSnapshotSchema.nullable(),
});

/** The data of a public event as an end user sees it (Q11): an allow-list of shapes. */
export const endUserActivityEventDataSchema = z.union([
  endUserStatusChangeDataSchema,
  endUserSnapshotChangeDataSchema,
]);
export type EndUserActivityEventData = z.infer<typeof endUserActivityEventDataSchema>;

/**
 * A public activity event of a ticket as an end user sees it (§4.5, Q11): events that are not
 * public never reach end users; the actor and the automatic source as for the team, except that
 * the actor is `null` without an automatic source when the reader may not see their name – a
 * customer of another organization, shown as "Customer" (§5.4, S1-11 Q9).
 */
export const endUserActivityEventSchema = z.object({
  id: z.uuid(),
  type: activityEventTypeSchema,
  data: endUserActivityEventDataSchema.nullable(),
  actor: z.object({ id: z.uuid(), displayName: z.string().nullable() }).nullable(),
  automaticSource: activityEventSourceSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type EndUserActivityEvent = z.infer<typeof endUserActivityEventSchema>;

/**
 * The response of an event: the team's shape for team accounts, the end user's for end users. The
 * serializer keeps only the fields of the matching shape.
 */
export const activityEventResponseSchema = z.union([
  activityEventSchema,
  endUserActivityEventSchema,
]);
export type ActivityEventResponse = z.infer<typeof activityEventResponseSchema>;

/** `GET /api/v1/tickets/{ticketId}/activity-events`: oldest first. */
export const listActivityEventsQuerySchema = pageQuerySchema;
export type ListActivityEventsQuery = z.infer<typeof listActivityEventsQuerySchema>;

export const activityEventPageSchema = pageSchema(activityEventResponseSchema);
export type ActivityEventPage = z.infer<typeof activityEventPageSchema>;
