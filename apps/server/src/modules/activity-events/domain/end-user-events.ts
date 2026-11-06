import type {
  ActivityEvent,
  EndUserActivityEvent,
  EndUserActivityEventData,
} from '@trybun/contracts/activity-events';
import { publicStatusOf, ticketStatusSchema } from '@trybun/contracts/tickets';

/**
 * The data of a public event as an end user sees it (Q11): an allow-list. A status change shows
 * the public statuses only, and the original of a new duplicate only when the reader may read it
 * (§3.5); whether it reopened the ticket, the waiting reason and the internal statuses never leave
 * the server. Other types have no public data yet.
 */
function endUserDataOf(
  event: ActivityEvent,
  readableOriginalIds: ReadonlySet<string>,
): EndUserActivityEventData | null {
  if (event.type !== 'status_changed' || event.data === null) {
    return null;
  }
  const { from, to, duplicateOf } = event.data;
  return {
    from: publicStatusOf(ticketStatusSchema.parse(from)),
    to: publicStatusOf(ticketStatusSchema.parse(to)),
    ...(duplicateOf != null && readableOriginalIds.has(duplicateOf.id) ? { duplicateOf } : {}),
  };
}

/**
 * The shape of a public event for an end user (§4.5, Q11), given the IDs of the originals of
 * duplicates the reader may read.
 */
export function toEndUserEvent(
  event: ActivityEvent,
  readableOriginalIds: ReadonlySet<string>,
): EndUserActivityEvent {
  return {
    id: event.id,
    type: event.type,
    data: endUserDataOf(event, readableOriginalIds),
    actor: event.actor,
    automaticSource: event.automaticSource,
    createdAt: event.createdAt,
  };
}

/** The originals of duplicates a page of events refers to, to be checked through the ability. */
export function originalIdsOf(events: readonly ActivityEvent[]): string[] {
  return [
    ...new Set(
      events.flatMap((event) =>
        event.type === 'status_changed' && event.data?.duplicateOf != null
          ? [event.data.duplicateOf.id]
          : [],
      ),
    ),
  ];
}
