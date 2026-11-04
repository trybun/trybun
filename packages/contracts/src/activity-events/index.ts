import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';

/**
 * `activity_event.type` (§4.5): one event per changed field of a ticket. Later tasks add theirs
 * (`status_changed` in S1-06, …).
 */
export const activityEventTypeSchema = z.enum([
  'title_changed',
  'description_edited',
  'type_changed',
  'priority_changed',
  'assignee_changed',
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

/** A value of a change: an enum code, a text, a snapshot of a reference, or none. */
export const activityEventValueSchema = z.union([
  z.string(),
  activityEventSnapshotSchema,
  z.null(),
]);
export type ActivityEventValue = z.infer<typeof activityEventValueSchema>;

/** The previous and the new value of a field; absent for `description_edited`. */
export const activityEventDataSchema = z.object({
  from: activityEventValueSchema,
  to: activityEventValueSchema,
});
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

/** `GET /api/v1/tickets/{ticketId}/activity-events`: oldest first. */
export const listActivityEventsQuerySchema = pageQuerySchema;
export type ListActivityEventsQuery = z.infer<typeof listActivityEventsQuerySchema>;

export const activityEventPageSchema = pageSchema(activityEventSchema);
export type ActivityEventPage = z.infer<typeof activityEventPageSchema>;
