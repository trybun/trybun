import type {
  ActivityEventData,
  ActivityEventTicketSnapshot,
  ActivityEventType,
} from '@trybun/contracts/activity-events';
import {
  isTerminalStatus,
  publicStatusOf,
  type ResolutionAnswer,
  type TicketSource,
  type TicketStatus,
  type TicketWaitingReason,
} from '@trybun/contracts/tickets';

/** The fields of a ticket that its status decides (§4.3). */
export interface StatusFields {
  status: TicketStatus;
  waitingReason: TicketWaitingReason | null;
  statusBeforeWaiting: TicketStatus | null;
  waitingSince: Date | null;
  closedAt: Date | null;
  rejectionReason: string | null;
}

/** A ticket as the status rules see it: its status fields and its source. */
export interface StatusTicket extends StatusFields {
  source: TicketSource;
}

/** One requested change of the status (§4.3) with what the service has resolved for it. */
export interface StatusChangeRequest {
  target: TicketStatus;
  /** The reason of a rejection, for `rejected`. */
  rejectionReason?: string;
  /** The original of a duplicate, already flattened to the original of a duplicate (§3.5). */
  original?: ActivityEventTicketSnapshot;
  /** The current original of the ticket, when it is a duplicate. */
  currentOriginal: ActivityEventTicketSnapshot | null;
  /** The project's resolution confirmation setting (§3.1). */
  confirmResolution: boolean;
  now: Date;
}

/** An activity event of the change, written by the service with the actor (§4.5). */
export interface StatusEvent {
  type: ActivityEventType;
  data: ActivityEventData | null;
  isPublic: boolean;
}

/** What happens to the ticket's `duplicate_of` relation. */
export type DuplicateRelationChange =
  { kind: 'keep' } | { kind: 'set'; original: ActivityEventTicketSnapshot } | { kind: 'remove' };

/** The values of the outbox event `ticket.status_changed`. */
export interface StatusChangedValues {
  from: TicketStatus;
  to: TicketStatus;
  waitingReason: TicketWaitingReason | null;
  reopen: boolean;
}

/** The result of a status change: what to write, in one transaction. */
export interface StatusChange {
  /** The new status fields; `null` when they stay as they are (no new version). */
  fields: StatusFields | null;
  relation: DuplicateRelationChange;
  events: StatusEvent[];
  /** The outbox event, when the status or the waiting reason changes. */
  statusChanged: StatusChangedValues | null;
  /** Whether the change moves the ticket from a terminal to a non-terminal status (Q6). */
  reopen: boolean;
}

/** The status fields of a ticket, without its other fields. */
export function statusFieldsOf(ticket: StatusFields): StatusFields {
  return {
    status: ticket.status,
    waitingReason: ticket.waitingReason,
    statusBeforeWaiting: ticket.statusBeforeWaiting,
    waitingSince: ticket.waitingSince,
    closedAt: ticket.closedAt,
    rejectionReason: ticket.rejectionReason,
  };
}

const NO_CHANGE: StatusChange = {
  fields: null,
  relation: { kind: 'keep' },
  events: [],
  statusChanged: null,
  reopen: false,
};

/**
 * The status a request actually leads to (§4.3): `done` on a ticket of an end user in a project
 * with resolution confirmation asks the requester first – unless the ticket is terminal or already
 * waits for the confirmation, which the team then overrides (Q5).
 */
function effectiveTarget(
  ticket: StatusTicket,
  request: StatusChangeRequest,
): { status: TicketStatus; waitingReason: TicketWaitingReason | null } {
  const isWaitingForConfirmation =
    ticket.status === 'waiting_for_requester' && ticket.waitingReason === 'confirmation';
  if (
    request.target === 'done' &&
    request.confirmResolution &&
    ticket.source === 'user' &&
    !isTerminalStatus(ticket.status) &&
    !isWaitingForConfirmation
  ) {
    return { status: 'waiting_for_requester', waitingReason: 'confirmation' };
  }
  // A move of the team into waiting always asks for information (Q4).
  return {
    status: request.target,
    waitingReason: request.target === 'waiting_for_requester' ? 'information' : null,
  };
}

function statusChangedEvent(
  from: TicketStatus,
  to: TicketStatus,
  values: {
    reopen: boolean;
    waitingReason: TicketWaitingReason | null;
    duplicateOf: ActivityEventTicketSnapshot | null;
  },
): StatusEvent {
  return {
    type: 'status_changed',
    data: { from, to, ...values },
    // Public only when the public status changes (§4.5, Q21).
    isPublic: publicStatusOf(from) !== publicStatusOf(to),
  };
}

/** A request for the current status (Q16): only a new reason, a new original or a new wait. */
function sameStatusChange(
  ticket: StatusTicket,
  request: StatusChangeRequest,
  waitingReason: TicketWaitingReason | null,
): StatusChange {
  if (ticket.status === 'waiting_for_requester' && waitingReason !== ticket.waitingReason) {
    // The reason switches and the wait restarts; the status before waiting stays.
    return {
      fields: { ...statusFieldsOf(ticket), waitingReason, waitingSince: request.now },
      relation: { kind: 'keep' },
      events: [
        statusChangedEvent(ticket.status, ticket.status, {
          reopen: false,
          waitingReason,
          duplicateOf: null,
        }),
      ],
      statusChanged: { from: ticket.status, to: ticket.status, waitingReason, reopen: false },
      reopen: false,
    };
  }
  if (
    ticket.status === 'rejected' &&
    request.rejectionReason !== undefined &&
    request.rejectionReason !== ticket.rejectionReason
  ) {
    // The text stays out of the event, so redacting it leaves no copy behind (§4.5).
    return {
      ...NO_CHANGE,
      fields: { ...statusFieldsOf(ticket), rejectionReason: request.rejectionReason },
      events: [{ type: 'rejection_reason_changed', data: null, isPublic: false }],
    };
  }
  if (
    ticket.status === 'duplicate' &&
    request.original !== undefined &&
    request.original.id !== request.currentOriginal?.id
  ) {
    return {
      ...NO_CHANGE,
      relation: { kind: 'set', original: request.original },
      events: [
        {
          type: 'duplicate_original_changed',
          data: { from: request.currentOriginal, to: request.original },
          isPublic: false,
        },
      ],
    };
  }
  return NO_CHANGE;
}

/**
 * A change of the status of a ticket (§4.3, the behaviour table of S1-06): the new status fields,
 * the change of its `duplicate_of` relation, its activity events and the values of its outbox
 * event. Pure: the service has resolved the original and passes the time.
 */
export function changeStatus(ticket: StatusTicket, request: StatusChangeRequest): StatusChange {
  const target = effectiveTarget(ticket, request);
  if (target.status === ticket.status) {
    return sameStatusChange(ticket, request, target.waitingReason);
  }
  const from = ticket.status;
  const to = target.status;
  const isReopen = isTerminalStatus(from) && !isTerminalStatus(to);
  const isWaiting = to === 'waiting_for_requester';
  const fields: StatusFields = {
    status: to,
    waitingReason: target.waitingReason,
    // After a reopen into waiting, a reply of the requester must never close it again (Q20).
    statusBeforeWaiting: isWaiting ? (isTerminalStatus(from) ? 'triage' : from) : null,
    waitingSince: isWaiting ? request.now : null,
    // The latest transition into a terminal status, also from another terminal one (Q6, Q12).
    closedAt: isTerminalStatus(to) ? request.now : null,
    rejectionReason: to === 'rejected' ? (request.rejectionReason ?? null) : null,
  };
  const duplicateOf = to === 'duplicate' ? (request.original ?? null) : null;
  const events: StatusEvent[] = [
    statusChangedEvent(from, to, {
      reopen: isReopen,
      waitingReason: target.waitingReason,
      duplicateOf,
    }),
  ];
  let relation: DuplicateRelationChange = { kind: 'keep' };
  if (duplicateOf !== null) {
    relation = { kind: 'set', original: duplicateOf };
  } else if (from === 'duplicate') {
    relation = { kind: 'remove' };
    events.push({
      type: 'duplicate_link_removed',
      data: { from: request.currentOriginal, to: null },
      isPublic: false,
    });
  }
  return {
    fields,
    relation,
    events,
    statusChanged: { from, to, waitingReason: target.waitingReason, reopen: isReopen },
    reopen: isReopen,
  };
}

/** The status an answer of the requester leads to (§4.3). */
export function answerTarget(answer: ResolutionAnswer): TicketStatus {
  return answer === 'solved' ? 'done' : 'in_progress';
}

/** Whether a ticket waits for the confirmation of its resolution (§4.3). */
export function waitsForConfirmation(ticket: Pick<StatusFields, 'status' | 'waitingReason'>) {
  return ticket.status === 'waiting_for_requester' && ticket.waitingReason === 'confirmation';
}

/** How long the requester has to answer before the ticket closes by itself: 7 × 24 hours (Q7). */
export const RESOLUTION_CONFIRMATION_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/** When the automatic close of a ticket that waits for confirmation is due. */
export function automaticCloseDueAt(waitingSince: Date): Date {
  return new Date(waitingSince.getTime() + RESOLUTION_CONFIRMATION_PERIOD_MS);
}
