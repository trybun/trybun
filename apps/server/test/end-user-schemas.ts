import {
  activityEventSnapshotSchema,
  activityEventTicketSnapshotSchema,
  endUserActivityEventSchema,
  endUserStatusChangeDataSchema,
} from '@trybun/contracts/activity-events';
import { endUserProjectSchema } from '@trybun/contracts/projects';
import {
  endUserTicketSchema,
  ticketPersonSchema,
  ticketProjectReferenceSchema,
  ticketReferenceSchema,
} from '@trybun/contracts/tickets';
import { z } from 'zod';

/**
 * Strict variants of the end-user response schemas for the leak tests (S1-09): they reject
 * unknown keys at every level, where the contract's `z.object` would strip an internal field
 * silently and hide the leak.
 */
export const strictEndUserProjectSchema = z.strictObject(endUserProjectSchema.shape);

export const strictEndUserTicketSchema = z.strictObject({
  ...endUserTicketSchema.shape,
  project: z.strictObject(ticketProjectReferenceSchema.shape),
  requester: z.strictObject(ticketPersonSchema.shape).nullable(),
  duplicateOf: z.strictObject(ticketReferenceSchema.shape).nullable(),
});

/** The strict end-user ticket of a list (S1-13 Q10): without the description. */
export const strictEndUserTicketListItemSchema = strictEndUserTicketSchema.omit({
  description: true,
});

export const strictEndUserActivityEventSchema = z.strictObject({
  ...endUserActivityEventSchema.shape,
  data: z
    .union([
      z.strictObject({
        ...endUserStatusChangeDataSchema.shape,
        duplicateOf: z.strictObject(activityEventTicketSnapshotSchema.shape).nullable().optional(),
      }),
      z.strictObject({
        from: z.strictObject(activityEventSnapshotSchema.shape).nullable(),
        to: z.strictObject(activityEventSnapshotSchema.shape).nullable(),
      }),
    ])
    .nullable(),
  actor: z.strictObject({ id: z.uuid(), displayName: z.string().nullable() }).nullable(),
});

/** A strict page of the cursor envelope (§18.4). */
export function strictPageSchema<Item extends z.ZodType>(item: Item) {
  return z.strictObject({ items: z.array(item), nextCursor: z.string().nullable() });
}
