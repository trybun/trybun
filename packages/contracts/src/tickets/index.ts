import { z } from 'zod';
import { pageQuerySchema, pageSchema } from '../pagination/index.js';
import { PROJECT_KEY_PATTERN } from '../projects/index.js';

/** `ticket.type` (§3.2): empty until triage for tickets of end users. */
export const ticketTypeSchema = z.enum(['bug', 'feature', 'task', 'question']);
export type TicketType = z.infer<typeof ticketTypeSchema>;

/** `ticket.source` (§3.2): set from the principal at creation, never changed. */
export const ticketSourceSchema = z.enum(['user', 'developer', 'integration']);
export type TicketSource = z.infer<typeof ticketSourceSchema>;

/** `ticket.priority` (§3.2): `normal` by default. */
export const ticketPrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);
export type TicketPriority = z.infer<typeof ticketPrioritySchema>;

/** `ticket.status` (§4.1): the internal statuses of the team workflow. */
export const ticketStatusSchema = z.enum([
  'new',
  'triage',
  'todo',
  'in_progress',
  'in_verification',
  'waiting_for_requester',
  'done',
  'rejected',
  'duplicate',
]);
export type TicketStatus = z.infer<typeof ticketStatusSchema>;

/** The terminal statuses (§4.1): a ticket in one of them is not open. */
export const TERMINAL_TICKET_STATUSES: readonly TicketStatus[] = ['done', 'rejected', 'duplicate'];

/** Whether a status is terminal (§4.1): `done`, `rejected` or `duplicate`. */
export function isTerminalStatus(status: TicketStatus): boolean {
  return TERMINAL_TICKET_STATUSES.includes(status);
}

/**
 * `ticket.waiting_reason` (§4.3): why a ticket in `waiting_for_requester` waits – the team asked
 * for `information`, or the requester is asked for the `confirmation` of the resolution.
 */
export const ticketWaitingReasonSchema = z.enum(['information', 'confirmation']);
export type TicketWaitingReason = z.infer<typeof ticketWaitingReasonSchema>;

/** The public statuses (§4.1): what end users see instead of the internal status. */
export const ticketPublicStatusSchema = z.enum([
  'received',
  'awaiting_reply',
  'in_progress',
  'resolved',
  'closed',
]);
export type TicketPublicStatus = z.infer<typeof ticketPublicStatusSchema>;

const PUBLIC_STATUSES: Record<TicketStatus, TicketPublicStatus> = {
  new: 'received',
  triage: 'received',
  todo: 'in_progress',
  in_progress: 'in_progress',
  in_verification: 'in_progress',
  waiting_for_requester: 'awaiting_reply',
  done: 'resolved',
  rejected: 'closed',
  duplicate: 'closed',
};

/** The public status of an internal status (§4.2), the one mapping of the API and the web. */
export function publicStatusOf(status: TicketStatus): TicketPublicStatus {
  return PUBLIC_STATUSES[status];
}

/** The requester's answer to "Is your problem solved?" (§4.3). */
export const resolutionAnswerSchema = z.enum(['solved', 'not_solved']);
export type ResolutionAnswer = z.infer<typeof resolutionAnswerSchema>;

/**
 * The action codes of a ticket (§18.3), sent in its `allowedActions`: `update` changes the title
 * and the description, `update_fields` the type and the priority, `assign` sets any eligible
 * assignee, `assign_self` only the principal, `change_status` changes the status (team), and
 * `confirm_resolution` answers the resolution confirmation (the requester, §7.5).
 */
export const ticketActionSchema = z.enum([
  'read',
  'update',
  'update_fields',
  'assign',
  'assign_self',
  'change_status',
  'confirm_resolution',
]);
export type TicketAction = z.infer<typeof ticketActionSchema>;

/** The title of a ticket: trimmed, 1–255 characters (§3.2). */
export const TICKET_TITLE_MAX_LENGTH = 255;
export const ticketTitleSchema = z.string().trim().min(1).max(TICKET_TITLE_MAX_LENGTH);

/** The description of a ticket: GFM Markdown, at most 65,536 characters (§3.2). */
export const TICKET_DESCRIPTION_MAX_LENGTH = 65_536;
export const ticketDescriptionSchema = z.string().max(TICKET_DESCRIPTION_MAX_LENGTH);

/**
 * `ticket.identifier` (§3.2): `KEY-number`, e.g. `ERP-12`; composed, never stored. The number has
 * at most nine digits, so it always fits the 32-bit integer column of the database.
 */
export const TICKET_IDENTIFIER_PATTERN = new RegExp(
  `^${PROJECT_KEY_PATTERN.source.slice(1, -1)}-[1-9][0-9]{0,8}$`,
);
export const ticketIdentifierSchema = z.string().regex(TICKET_IDENTIFIER_PATTERN);

/** The identifier of the ticket with a number in the project with a key. */
export function ticketIdentifier(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}

/**
 * `POST /api/v1/tickets`. `type`, `priority` and `assigneeId` belong to the full form of the team
 * (§7.5): an end user sending them gets `403`.
 */
export const createTicketSchema = z.object({
  projectId: z.uuid(),
  title: ticketTitleSchema,
  description: ticketDescriptionSchema.optional(),
  type: ticketTypeSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
});
export type CreateTicketDto = z.infer<typeof createTicketSchema>;

/**
 * `PATCH /api/v1/tickets/{ticketId}`: the fields to change, at least one. `projectId` is accepted
 * only to be rejected with `ticket.project_immutable` when it names another project (§3.2). A body
 * with a field the principal may not change is rejected as a whole (§18.3).
 */
export const updateTicketSchema = z
  .object({
    projectId: z.uuid().optional(),
    title: ticketTitleSchema.optional(),
    description: ticketDescriptionSchema.optional(),
    type: ticketTypeSchema.optional(),
    priority: ticketPrioritySchema.optional(),
    assigneeId: z.uuid().nullable().optional(),
  })
  .refine((input) => Object.values(input).some((value) => value !== undefined));
export type UpdateTicketDto = z.infer<typeof updateTicketSchema>;

/** The reason of a rejection: GFM Markdown, trimmed, 1–2000 characters (§4.3). */
export const TICKET_REJECTION_REASON_MAX_LENGTH = 2000;
export const ticketRejectionReasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(TICKET_REJECTION_REASON_MAX_LENGTH);

/** The statuses that need no further field when a ticket is moved to them. */
const PLAIN_TARGET_STATUSES = ticketStatusSchema.exclude(['rejected', 'duplicate']);

/**
 * `PUT /api/v1/tickets/{ticketId}/status` (§4.3): the target status, with the reason for
 * `rejected` and the original for `duplicate`; any other field is unrecognized.
 */
export const changeTicketStatusSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('rejected'), rejectionReason: ticketRejectionReasonSchema }),
  z.strictObject({ status: z.literal('duplicate'), duplicateOfTicketId: z.uuid() }),
  z.strictObject({ status: PLAIN_TARGET_STATUSES }),
]);
export type ChangeTicketStatusDto = z.infer<typeof changeTicketStatusSchema>;

/** `POST /api/v1/tickets/{ticketId}/resolution-confirmation` (§4.3): the requester's answer. */
export const confirmResolutionSchema = z.object({ answer: resolutionAnswerSchema });
export type ConfirmResolutionDto = z.infer<typeof confirmResolutionSchema>;

/** The original of a duplicate as a ticket shows it (§3.5). */
export const ticketReferenceSchema = z.object({
  id: z.uuid(),
  number: z.int().min(1),
  projectKey: z.string(),
});
export type TicketReference = z.infer<typeof ticketReferenceSchema>;

/** A person as a ticket shows them: the display name, never the e-mail address. */
export const ticketPersonSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
});
export type TicketPerson = z.infer<typeof ticketPersonSchema>;

/** The fields of a ticket every reader sees (§3.2). */
const commonTicketFields = {
  id: z.uuid(),
  projectId: z.uuid(),
  number: z.int().min(1),
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
  requester: ticketPersonSchema,
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  allowedActions: z.array(ticketActionSchema),
  /** The public status (§4.2); with `waitingReason` it selects the public description. */
  publicStatus: ticketPublicStatusSchema,
  waitingReason: ticketWaitingReasonSchema.nullable(),
  /** The original of a duplicate; for an end user only when they may read it (§3.5). */
  duplicateOf: ticketReferenceSchema.nullable(),
};

/** A ticket as the team sees it (§3.2). */
export const ticketSchema = z.object({
  ...commonTicketFields,
  type: ticketTypeSchema.nullable(),
  source: ticketSourceSchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  organization: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  assignee: ticketPersonSchema.nullable(),
  /** The time of the latest transition into a terminal status (§4.3); none while open. */
  closedAt: z.iso.datetime().nullable(),
  /** The reason of a rejection, for the team only until S1-12 publishes it as a comment. */
  rejectionReason: z.string().nullable(),
});
export type Ticket = z.infer<typeof ticketSchema>;

/**
 * A ticket as an end user sees it (§3.2, columns "End user"): without type, priority, assignee,
 * source, organization, the internal status and the rejection reason.
 */
export const endUserTicketSchema = z.object(commonTicketFields);
export type EndUserTicket = z.infer<typeof endUserTicketSchema>;

/**
 * The response of a ticket: the team's shape for team accounts, the end user's for end users. The
 * serializer keeps only the fields of the matching shape.
 */
export const ticketResponseSchema = z.union([ticketSchema, endUserTicketSchema]);
export type TicketResponse = z.infer<typeof ticketResponseSchema>;

/** The path parameters of a ticket. */
export const ticketParamsSchema = z.object({ ticketId: z.uuid() });
export type TicketParams = z.infer<typeof ticketParamsSchema>;

/**
 * `GET /api/v1/tickets`: newest first – by number within a project. `identifier` returns at most
 * the one ticket with it (§3.2); filters and sorting of the list views come with S1-13.
 */
export const listTicketsQuerySchema = pageQuerySchema.extend({
  projectId: z.uuid().optional(),
  identifier: ticketIdentifierSchema.optional(),
});
export type ListTicketsQuery = z.infer<typeof listTicketsQuerySchema>;

export const ticketPageSchema = pageSchema(ticketResponseSchema);
export type TicketPage = z.infer<typeof ticketPageSchema>;
