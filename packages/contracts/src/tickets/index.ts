import { z } from 'zod';
import { errorCodeSchema } from '../errors/index.js';
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

/**
 * The default priority of each type's template of the team (§3.4): what the full form proposes
 * for the chosen type (S1-10 Q1). The API sets `normal` when a request omits the priority (§3.2).
 */
export const TICKET_TYPE_DEFAULT_PRIORITY: Readonly<Record<TicketType, TicketPriority>> = {
  bug: 'normal',
  feature: 'normal',
  task: 'normal',
  question: 'low',
};

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

/**
 * `ticket.visibility` (§5.1): who among the customers sees a ticket besides its requester – the
 * effective visibility, which a pending sharing request keeps until the team approves it.
 */
export const ticketVisibilitySchema = z.enum(['only_me', 'my_organization', 'all_customers']);
export type TicketVisibility = z.infer<typeof ticketVisibilitySchema>;

/**
 * `ticket.sharing_request` (§5.2): the state of the author's request to share a ticket with all
 * customers – `pending` until one team member decides it, `rejected` after a refusal.
 */
export const ticketSharingRequestSchema = z.enum(['none', 'pending', 'rejected']);
export type TicketSharingRequest = z.infer<typeof ticketSharingRequestSchema>;

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

/**
 * The description of a ticket's state shown to end users (§4.2): one code per row of the mapping,
 * so the stage of the team's workflow is described without revealing the internal status (Q11).
 */
export const publicStatusDescriptionSchema = z.enum([
  'received',
  'analyzing',
  'information_needed',
  'confirmation_needed',
  'scheduled',
  'working',
  'testing',
  'resolved',
  'rejected',
  'merged',
]);
export type PublicStatusDescription = z.infer<typeof publicStatusDescriptionSchema>;

const PUBLIC_STATUS_DESCRIPTIONS: Record<
  Exclude<TicketStatus, 'waiting_for_requester'>,
  PublicStatusDescription
> = {
  new: 'received',
  triage: 'analyzing',
  todo: 'scheduled',
  in_progress: 'working',
  in_verification: 'testing',
  done: 'resolved',
  rejected: 'rejected',
  duplicate: 'merged',
};

/**
 * The public description of a status (§4.2), next to `publicStatusOf`: a ticket waiting for the
 * requester is described by its waiting reason; the reason of any other status is ignored.
 */
export function publicStatusDescriptionOf(
  status: TicketStatus,
  waitingReason: TicketWaitingReason | null,
): PublicStatusDescription {
  if (status === 'waiting_for_requester') {
    return waitingReason === 'confirmation' ? 'confirmation_needed' : 'information_needed';
  }
  return PUBLIC_STATUS_DESCRIPTIONS[status];
}

/** The requester's answer to "Is your problem solved?" (§4.3). */
export const resolutionAnswerSchema = z.enum(['solved', 'not_solved']);
export type ResolutionAnswer = z.infer<typeof resolutionAnswerSchema>;

/**
 * The action codes of a ticket (§18.3), sent in its `allowedActions`: `update` changes the title
 * and the description, `update_fields` the type and the priority, `assign` sets any eligible
 * assignee, `assign_self` only the principal, `change_status` changes the status (team),
 * `confirm_resolution` answers the resolution confirmation (the requester, §7.5),
 * `add_attachment` links files to the ticket (§3.2), `set_visibility_<value>` changes the
 * visibility to that value – for the requester, `set_visibility_all_customers` requests sharing –
 * and `approve_sharing` / `reject_sharing` decide a pending sharing request (team, §5.2, S1-11).
 * `add_comment` writes a public comment – its restriction carries `ticket.comments_closed` on a
 * closed ticket (§4.3) – `add_internal_note` an internal note (team), `read_description_revisions`
 * lists the earlier versions of the description and `redact_description` redacts it (team, S1-12).
 */
export const ticketActionSchema = z.enum([
  'read',
  'update',
  'update_fields',
  'assign',
  'assign_self',
  'change_status',
  'confirm_resolution',
  'add_attachment',
  'set_visibility_only_me',
  'set_visibility_my_organization',
  'set_visibility_all_customers',
  'approve_sharing',
  'reject_sharing',
  'add_comment',
  'add_internal_note',
  'read_description_revisions',
  'redact_description',
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

/** The number of draft attachments linked to a ticket by one request (§3.2). */
export const MAX_LINKED_ATTACHMENTS_PER_REQUEST = 100;

/**
 * `POST /api/v1/tickets`. `type`, `priority` and `assigneeId` belong to the full form of the team
 * (§7.5): an end user sending them gets `403`. `visibility` (default `only_me`, §5.1) needs the
 * project action of its value – `all_customers` creates a pending sharing request (S1-11). `attachmentIds` are the principal's own drafts,
 * linked to the new ticket without activity events (§3.2, §4.5).
 */
export const createTicketSchema = z.object({
  projectId: z.uuid(),
  title: ticketTitleSchema,
  description: ticketDescriptionSchema.optional(),
  type: ticketTypeSchema.optional(),
  priority: ticketPrioritySchema.optional(),
  assigneeId: z.uuid().nullable().optional(),
  attachmentIds: z.array(z.uuid()).max(MAX_LINKED_ATTACHMENTS_PER_REQUEST).optional(),
  visibility: ticketVisibilitySchema.optional(),
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
export const confirmResolutionSchema = z.strictObject({ answer: resolutionAnswerSchema });
export type ConfirmResolutionDto = z.infer<typeof confirmResolutionSchema>;

/**
 * `PUT /api/v1/tickets/{ticketId}/visibility` (§5.3): the target visibility. For the requester,
 * `all_customers` requests sharing, and `only_me` or `my_organization` withdraws a pending request.
 */
export const setTicketVisibilitySchema = z.strictObject({ visibility: ticketVisibilitySchema });
export type SetTicketVisibilityDto = z.infer<typeof setTicketVisibilitySchema>;

/** The reason of a sharing refusal: GFM Markdown, trimmed, 1–2000 characters (§5.2). */
export const TICKET_SHARING_REFUSAL_REASON_MAX_LENGTH = 2000;
export const ticketSharingRefusalReasonSchema = z
  .string()
  .trim()
  .min(1)
  .max(TICKET_SHARING_REFUSAL_REASON_MAX_LENGTH);

/** `POST /api/v1/tickets/{ticketId}/sharing/reject` (§5.2): the required reason. */
export const rejectTicketSharingSchema = z.strictObject({
  reason: ticketSharingRefusalReasonSchema,
});
export type RejectTicketSharingDto = z.infer<typeof rejectTicketSharingSchema>;

/** The original of a duplicate as a ticket shows it (§3.5). */
export const ticketReferenceSchema = z.object({
  id: z.uuid(),
  number: z.int().min(1),
  projectKey: z.string(),
});
export type TicketReference = z.infer<typeof ticketReferenceSchema>;

/**
 * The project of a ticket as the ticket shows it (Q19): readable with the ticket, also when the
 * project is archived or the requester has lost access to it.
 */
export const ticketProjectReferenceSchema = z.object({
  id: z.uuid(),
  key: z.string(),
  name: z.string(),
});
export type TicketProjectReference = z.infer<typeof ticketProjectReferenceSchema>;

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
  project: ticketProjectReferenceSchema,
  number: z.int().min(1),
  identifier: z.string(),
  title: z.string(),
  description: z.string(),
  version: z.int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  allowedActions: z.array(ticketActionSchema),
  /** The public status (§4.2); with `waitingReason` it selects the public description. */
  publicStatus: ticketPublicStatusSchema,
  waitingReason: ticketWaitingReasonSchema.nullable(),
  /** The original of a duplicate; for an end user only when they may read it (§3.5). */
  duplicateOf: ticketReferenceSchema.nullable(),
  /** The effective visibility and the sharing request (§5.1, §5.2). */
  visibility: ticketVisibilitySchema,
  sharingRequest: ticketSharingRequestSchema,
  /** The time of the last edit or redaction of the description; the UI shows "edited" (§6.1). */
  descriptionEditedAt: z.iso.datetime().nullable(),
};

/** A ticket as the team sees it (§3.2). */
export const ticketSchema = z.object({
  ...commonTicketFields,
  requester: ticketPersonSchema,
  type: ticketTypeSchema.nullable(),
  source: ticketSourceSchema,
  priority: ticketPrioritySchema,
  status: ticketStatusSchema,
  organization: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  assignee: ticketPersonSchema.nullable(),
  /** The time of the latest transition into a terminal status (§4.3); none while open. */
  closedAt: z.iso.datetime().nullable(),
});
export type Ticket = z.infer<typeof ticketSchema>;

/**
 * A ticket as an end user sees it (§3.2, columns "End user"): without type, priority, assignee,
 * source, organization and the internal status, with the public description
 * of its state instead (§4.2).
 */
export const endUserTicketSchema = z.object({
  ...commonTicketFields,
  /**
   * The requester; `null` when the reader may not see their name – a customer of another
   * organization, shown as "Customer" (§5.4, S1-11 Q9).
   */
  requester: ticketPersonSchema.nullable(),
  publicStatusDescription: publicStatusDescriptionSchema,
});
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
 * The involvement of the principal in the tickets of a list: `mine` – the tickets they requested
 * ("My tickets", §5.7); S1-15 widens it to the tickets they watch.
 */
export const ticketInvolvementSchema = z.enum(['mine']);
export type TicketInvolvement = z.infer<typeof ticketInvolvementSchema>;

/** The largest number of values of one filter of the ticket list (S1-13). */
export const MAX_TICKET_FILTER_VALUES = 50;

/**
 * A query parameter with one or more values (S1-13): repeated (`status=new&status=triage`) or
 * once; the values of one filter are combined with OR.
 */
function oneOrMore<Item extends z.ZodType>(item: Item) {
  return z
    .union([item, z.array(item).min(1).max(MAX_TICKET_FILTER_VALUES)])
    .transform((value): z.output<Item>[] => (Array.isArray(value) ? value : [value]));
}

/** The value of a filter that matches tickets without the field: no type, no organization. */
export const TICKET_FILTER_NONE = 'none';

/** The value of the assignee filter that is the principal (S1-13). */
export const TICKET_FILTER_ME = 'me';

/** The sharing requests the list filters by (S1-13): `none` is not a filter value. */
export const ticketSharingRequestFilterSchema = ticketSharingRequestSchema.exclude(['none']);
export type TicketSharingRequestFilter = z.infer<typeof ticketSharingRequestFilterSchema>;

/**
 * The filters of the ticket list (§8.1, S1-13), all multi-valued; filters are combined with AND. A
 * value of a record the principal cannot see matches no ticket (Q5). Every filter but `projectId`
 * is for the team only (Q21). S1-14's board reuses them.
 */
export const ticketListFiltersSchema = z.object({
  projectId: oneOrMore(z.uuid()).optional(),
  organizationId: oneOrMore(z.union([z.uuid(), z.literal(TICKET_FILTER_NONE)])).optional(),
  type: oneOrMore(z.union([ticketTypeSchema, z.literal(TICKET_FILTER_NONE)])).optional(),
  status: oneOrMore(ticketStatusSchema).optional(),
  priority: oneOrMore(ticketPrioritySchema).optional(),
  assigneeId: oneOrMore(
    z.union([z.uuid(), z.literal(TICKET_FILTER_ME), z.literal(TICKET_FILTER_NONE)]),
  ).optional(),
  source: oneOrMore(ticketSourceSchema).optional(),
  sharingRequest: oneOrMore(ticketSharingRequestFilterSchema).optional(),
});
export type TicketListFilters = z.output<typeof ticketListFiltersSchema>;

/** The sort keys of the ticket list (§8.1, S1-13 Q8). */
export const ticketListSortSchema = z.enum([
  'priority',
  'status',
  'identifier',
  'createdAt',
  'updatedAt',
]);
export type TicketListSort = z.infer<typeof ticketListSortSchema>;

/** The direction of a sort (S1-13): `desc` unless given. */
export const sortOrderSchema = z.enum(['asc', 'desc']);
export type SortOrder = z.infer<typeof sortOrderSchema>;

/**
 * The parameters of `GET /api/v1/tickets` that only team accounts may send (Q21): an end user
 * sending one gets `422 field.unrecognized`, so the list never reveals a field their response hides.
 */
export const TEAM_TICKET_LIST_PARAMETERS = [
  'organizationId',
  'type',
  'status',
  'priority',
  'assigneeId',
  'source',
  'sharingRequest',
  'sort',
  'order',
] as const satisfies readonly (keyof ListTicketsQuery)[];

/**
 * `GET /api/v1/tickets`. Without `sort`: newest first – by number within one project.
 * `identifier` returns at most the one ticket with it (§3.2). `involvement=mine` lists the tickets
 * the principal requested in a fixed order instead: those awaiting the requester's reply first,
 * then the most recently updated, then by ID. Such a page may be shorter than `limit` while
 * `nextCursor` is set; it is not combined with `identifier` or the parameters of the team.
 * `sort` orders by the key, then by the last update (newest first), then by ID (S1-13 Q8);
 * `order` needs `sort`.
 */
export const listTicketsQuerySchema = pageQuerySchema
  .extend({
    ...ticketListFiltersSchema.shape,
    identifier: ticketIdentifierSchema.optional(),
    involvement: ticketInvolvementSchema.optional(),
    sort: ticketListSortSchema.optional(),
    order: sortOrderSchema.optional(),
  })
  .superRefine((query, context) => {
    if (query.involvement !== undefined) {
      for (const key of ['identifier', ...TEAM_TICKET_LIST_PARAMETERS] as const) {
        if (query[key] !== undefined) {
          context.addIssue({ code: 'custom', path: [key], message: 'Not with involvement' });
        }
      }
    }
    if (query.order !== undefined && query.sort === undefined) {
      context.addIssue({ code: 'custom', path: ['order'], message: 'Needs sort' });
    }
  });
export type ListTicketsQuery = z.output<typeof listTicketsQuerySchema>;

/** A ticket of the team in a list (S1-13 Q10): without the description. */
export const ticketListItemSchema = ticketSchema.omit({ description: true });
export type TicketListItem = z.infer<typeof ticketListItemSchema>;

/** A ticket of an end user in a list (S1-13 Q10): without the description. */
export const endUserTicketListItemSchema = endUserTicketSchema.omit({ description: true });
export type EndUserTicketListItem = z.infer<typeof endUserTicketListItemSchema>;

/**
 * An item of `GET /api/v1/tickets` (S1-13 Q10): a ticket without its description, in the team's
 * or the end user's shape; the detail `GET /api/v1/tickets/{ticketId}` carries the description.
 */
export const ticketListItemResponseSchema = z.union([
  ticketListItemSchema,
  endUserTicketListItemSchema,
]);
export type TicketListItemResponse = z.infer<typeof ticketListItemResponseSchema>;

export const ticketPageSchema = pageSchema(ticketListItemResponseSchema);
export type TicketPage = z.infer<typeof ticketPageSchema>;

/** The largest number of tickets of one bulk change (§8.1, §17.2). */
export const MAX_BULK_CHANGE_TICKETS = 100;

/** A ticket of a bulk change: its ID and the version the change expects (§17.2 "Concurrency"). */
export const bulkChangeTargetSchema = z.strictObject({ id: z.uuid(), version: z.int().min(1) });
export type BulkChangeTarget = z.infer<typeof bulkChangeTargetSchema>;

/** The statuses a bulk change may set (§8.1): every status but `duplicate`. */
const BULK_TARGET_STATUSES = ticketStatusSchema.exclude(['duplicate']);

/**
 * The one change of a bulk change (S1-13 Q2, Q3): a status – with one reason for `rejected`, used
 * for every ticket – a priority or an assignee (`null` unassigns).
 */
export const bulkTicketChangeSchema = z.discriminatedUnion('field', [
  z
    .strictObject({
      field: z.literal('status'),
      status: BULK_TARGET_STATUSES,
      rejectionReason: ticketRejectionReasonSchema.optional(),
    })
    .superRefine((change, context) => {
      if (change.status === 'rejected' && change.rejectionReason === undefined) {
        context.addIssue({ code: 'custom', path: ['rejectionReason'], message: 'Required' });
      }
      if (change.status !== 'rejected' && change.rejectionReason !== undefined) {
        context.addIssue({
          code: 'unrecognized_keys',
          keys: ['rejectionReason'],
          path: [],
          message: 'Only for rejected',
        });
      }
    }),
  z.strictObject({ field: z.literal('priority'), priority: ticketPrioritySchema }),
  z.strictObject({ field: z.literal('assignee'), assigneeId: z.uuid().nullable() }),
]);
export type BulkTicketChange = z.infer<typeof bulkTicketChangeSchema>;

/**
 * `POST /api/v1/tickets/bulk-changes` (§8.1, §17.2): one change for 1–100 tickets with unique
 * IDs, each changed in its own transaction in request order.
 */
export const bulkChangeTicketsSchema = z.strictObject({
  tickets: z
    .array(bulkChangeTargetSchema)
    .min(1)
    .max(MAX_BULK_CHANGE_TICKETS)
    .superRefine((tickets, context) => {
      const seen = new Set<string>();
      tickets.forEach((ticket, index) => {
        if (seen.has(ticket.id)) {
          context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Repeated' });
        }
        seen.add(ticket.id);
      });
    }),
  change: bulkTicketChangeSchema,
});
export type BulkChangeTicketsDto = z.infer<typeof bulkChangeTicketsSchema>;

/** The HTTP statuses of a ticket that a bulk change did not change (S1-13 Q1). */
export const bulkChangeFailureStatusSchema = z.union([
  z.literal(403),
  z.literal(404),
  z.literal(409),
  z.literal(412),
  z.literal(422),
  z.literal(500),
]);
export type BulkChangeFailureStatus = z.infer<typeof bulkChangeFailureStatusSchema>;

/**
 * The result of one ticket of a bulk change (S1-13 Q1): `200` with the changed ticket – its actual
 * status, e.g. after the redirect of `done` – or the status and the error code a single change
 * would have answered.
 */
export const bulkChangeResultSchema = z.union([
  z.object({ id: z.uuid(), status: z.literal(200), ticket: ticketListItemSchema }),
  z.object({ id: z.uuid(), status: bulkChangeFailureStatusSchema, code: errorCodeSchema }),
]);
export type BulkChangeResult = z.infer<typeof bulkChangeResultSchema>;

/** The response of a bulk change: one result per ticket, in request order. */
export const bulkChangeTicketsResponseSchema = z.object({
  results: z.array(bulkChangeResultSchema),
});
export type BulkChangeTicketsResponse = z.infer<typeof bulkChangeTicketsResponseSchema>;
