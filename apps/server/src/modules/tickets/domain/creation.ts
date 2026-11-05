import type {
  TicketPriority,
  TicketSource,
  TicketStatus,
  TicketType,
} from '@trybun/contracts/tickets';
import type { UserKind } from '@trybun/contracts/users';

/** The source of a ticket from the kind of the account that creates it (§3.2). */
export function sourceOf(kind: UserKind): TicketSource {
  return kind === 'end_user' ? 'user' : 'developer';
}

/**
 * The initial status of a ticket (§4.3): a ticket from a user or an integration waits for triage
 * in `new`; one the team creates is planned work in `todo`. Every later change belongs to the
 * status use cases (S1-06).
 */
export function initialStatusOf(source: TicketSource): TicketStatus {
  return source === 'developer' ? 'todo' : 'new';
}

/**
 * The fields of a new ticket the principal did not set (§3.2, §3.3): the priority is `normal`; the
 * type is `task` when the team omits it, and empty for an end user until triage.
 */
export function creationDefaults(
  kind: UserKind,
  input: { type?: TicketType; priority?: TicketPriority },
): {
  source: TicketSource;
  status: TicketStatus;
  type: TicketType | null;
  priority: TicketPriority;
} {
  const source = sourceOf(kind);
  return {
    source,
    status: initialStatusOf(source),
    type: kind === 'end_user' ? null : (input.type ?? 'task'),
    priority: input.priority ?? 'normal',
  };
}
