import type { ActivityEventData, ActivityEventType } from '@trybun/contracts/activity-events';
import type { TicketSharingRequest, TicketVisibility } from '@trybun/contracts/tickets';

/** The fields of a ticket that its visibility and sharing request decide (§5.1, §5.2). */
export interface VisibilityFields {
  visibility: TicketVisibility;
  sharingRequest: TicketSharingRequest;
  sharingRefusalReason: string | null;
}

/** The activity event of a use case, written by the service with the actor (§4.5). */
export interface VisibilityEvent {
  type: ActivityEventType;
  data: ActivityEventData | null;
  isPublic: boolean;
}

/**
 * The outcome of a use case of S1-11: the new fields – `null` when nothing changes – the one
 * activity event, and whether the team's change is an entry of the audit log (§13.5, Q17).
 */
export interface VisibilityChange {
  fields: VisibilityFields | null;
  event: VisibilityEvent | null;
  audit: 'ticket.visibility_changed' | 'ticket.sharing_approved' | 'ticket.sharing_rejected' | null;
}

const UNCHANGED: VisibilityChange = { fields: null, event: null, audit: null };

/** Who asks for a change, and what the service has resolved for it. */
export interface VisibilityRequest {
  target: TicketVisibility;
  /** The ticket's requester; anyone else allowed to change it is the team (§5.3). */
  byRequester: boolean;
  /**
   * Whether the requester could choose `my_organization` now (Q4, Q19): a sharing request widens
   * an `only_me` ticket to it only then.
   */
  mayChooseOrganization: boolean;
}

function event(
  type: ActivityEventType,
  from: TicketVisibility,
  to: TicketVisibility,
): VisibilityEvent {
  return { type, data: { from, to }, isPublic: false };
}

/**
 * A change of the visibility (§5.3, S1-11): the requester's `all_customers` requests sharing and
 * keeps the effective visibility – `my_organization` when they could choose it, else unchanged
 * (Q4); while a request of the requester is pending, `only_me` and `my_organization` withdraw it,
 * also for the current value (Q5); the team's `all_customers` shares the ticket and clears a
 * refusal. Between `only_me` and `my_organization`, a refusal and its reason stay. The current
 * value changes nothing (Q12).
 */
export function changeVisibility(
  before: VisibilityFields,
  request: VisibilityRequest,
): VisibilityChange {
  const { target, byRequester } = request;
  if (byRequester && before.sharingRequest === 'pending') {
    if (target === 'all_customers') {
      return UNCHANGED;
    }
    return {
      fields: { ...before, visibility: target, sharingRequest: 'none' },
      event: event('sharing_request_withdrawn', before.visibility, target),
      audit: null,
    };
  }
  if (byRequester && target === 'all_customers') {
    const effective =
      before.visibility === 'only_me' && request.mayChooseOrganization
        ? 'my_organization'
        : before.visibility;
    return {
      fields: { visibility: effective, sharingRequest: 'pending', sharingRefusalReason: null },
      event: event('sharing_requested', before.visibility, effective),
      audit: null,
    };
  }
  if (target === before.visibility) {
    return UNCHANGED;
  }
  const fields: VisibilityFields =
    target === 'all_customers'
      ? { visibility: target, sharingRequest: 'none', sharingRefusalReason: null }
      : { ...before, visibility: target };
  return {
    fields,
    event: event('visibility_changed', before.visibility, target),
    audit: byRequester ? null : 'ticket.visibility_changed',
  };
}

/**
 * One team approval of a pending request (§5.2): the ticket is shared with all customers, with the
 * one public event "Shared with everyone".
 */
export function approveSharing(before: VisibilityFields): VisibilityChange {
  return {
    fields: { visibility: 'all_customers', sharingRequest: 'none', sharingRefusalReason: null },
    event: {
      type: 'sharing_approved',
      data: { from: before.visibility, to: 'all_customers' },
      isPublic: true,
    },
    audit: 'ticket.sharing_approved',
  };
}

/**
 * A refusal of a pending request with its reason (§5.2): the visibility stays, the request becomes
 * `rejected`; the reason never enters the event (Q8, Q11).
 */
export function rejectSharing(before: VisibilityFields, reason: string): VisibilityChange {
  return {
    fields: { ...before, sharingRequest: 'rejected', sharingRefusalReason: reason },
    event: { type: 'sharing_rejected', data: null, isPublic: false },
    audit: 'ticket.sharing_rejected',
  };
}

/**
 * The visibility of a new ticket (§5.1, S1-11): treated as an `only_me` ticket whose author applies
 * the chosen visibility as their first change – `all_customers` creates a pending request with the
 * effective visibility of a request (Q4). The caller has checked the project action of the value.
 */
export function initialVisibility(
  requested: TicketVisibility,
  mayChooseOrganization: boolean,
): VisibilityFields {
  const onlyMe: VisibilityFields = {
    visibility: 'only_me',
    sharingRequest: 'none',
    sharingRefusalReason: null,
  };
  return (
    changeVisibility(onlyMe, { target: requested, byRequester: true, mayChooseOrganization })
      .fields ?? onlyMe
  );
}
