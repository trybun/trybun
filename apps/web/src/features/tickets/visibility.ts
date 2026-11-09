import type { ProjectAction } from '@trybun/contracts/projects';
import type {
  TicketAction,
  TicketSharingRequest,
  TicketVisibility,
} from '@trybun/contracts/tickets';

/** The visibility values in the order of the control (§5.1): narrowest first. */
export const VISIBILITY_ORDER: readonly TicketVisibility[] = [
  'only_me',
  'my_organization',
  'all_customers',
];

/**
 * The options of a new ticket (§5.1, S1-11 Q7): `only_me` always, the others when the project's
 * `allowedActions` carry their action – the API decides them, the web application never does
 * (§14.4).
 */
export function creationVisibilityOptions(
  allowedActions: readonly ProjectAction[],
): TicketVisibility[] {
  return VISIBILITY_ORDER.filter(
    (value) =>
      value === 'only_me' ||
      (value === 'my_organization' && allowedActions.includes('create_ticket_my_organization')) ||
      (value === 'all_customers' && allowedActions.includes('create_ticket_all_customers')),
  );
}

/**
 * The value a ticket's visibility control shows (§5.2): a ticket whose request is pending shows
 * **All customers**, marked as waiting; otherwise the effective visibility.
 */
export function shownVisibility(ticket: {
  visibility: TicketVisibility;
  sharingRequest: TicketSharingRequest;
}): TicketVisibility {
  return ticket.sharingRequest === 'pending' ? 'all_customers' : ticket.visibility;
}

/**
 * The options of a ticket's visibility control: the shown value and every value whose
 * `set_visibility_<value>` the ticket's `allowedActions` carry. With nothing to change, the
 * control is text.
 */
export function ticketVisibilityOptions(ticket: {
  visibility: TicketVisibility;
  sharingRequest: TicketSharingRequest;
  allowedActions: readonly TicketAction[];
}): TicketVisibility[] {
  const shown = shownVisibility(ticket);
  return VISIBILITY_ORDER.filter(
    (value) => value === shown || ticket.allowedActions.includes(`set_visibility_${value}`),
  );
}
