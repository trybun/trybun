import {
  ticketPublicStatusSchema,
  ticketStatusSchema,
  ticketWaitingReasonSchema,
} from '@trybun/contracts/tickets';
import { z } from 'zod';

/**
 * The status of a ticket changed (§4.3), or its waiting reason did. The timer of the resolution
 * confirmation is its first consumer; S1-15 adds notifications and S6 webhooks.
 */
export const TICKET_STATUS_CHANGED = 'ticket.status_changed';

/**
 * The payload of `ticket.status_changed`: identifiers and status codes, never the rejection
 * reason or other content (§18.3). `actorId` is `null` for an automatic change; `commentId` names
 * the requester's comment that changed it (S1-12).
 */
export const ticketStatusChangedPayloadSchema = z.object({
  ticketId: z.uuid(),
  projectId: z.uuid(),
  from: ticketStatusSchema,
  to: ticketStatusSchema,
  fromPublic: ticketPublicStatusSchema,
  toPublic: ticketPublicStatusSchema,
  waitingReason: ticketWaitingReasonSchema.nullable(),
  reopen: z.boolean(),
  actorId: z.uuid().nullable(),
  /**
   * The comment of the requester that caused the change (S1-12 Q15): additive, so the payloads of
   * earlier releases parse unchanged (§17.2, "Payload compatibility").
   */
  commentId: z.uuid().optional(),
});
export type TicketStatusChangedPayload = z.infer<typeof ticketStatusChangedPayloadSchema>;
