'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Ticket } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { useFormatter, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { activityEventsQueryOptions } from '../queries.js';
import { ActivityEventItem } from './activity-event-item.js';

/**
 * The team's activity timeline of a ticket (§4.5, Q13): "{requester} opened the ticket" from its
 * creation time as the first item – no event records the creation – then every event the API
 * returns, internal and public, oldest first, 50 per page with **Show more** at the end.
 */
export function ActivityTimeline({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const events = useInfiniteQuery(activityEventsQueryOptions(browserApiClient, ticket.id));
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section aria-labelledby="ticket-activity" className="flex flex-col gap-3">
      <h2 id="ticket-activity" className="text-lg font-semibold">
        {t('timeline.title')}
      </h2>
      <ol className="flex flex-col gap-3 border-l border-border pl-4">
        <li className="flex flex-col">
          <span className="break-words">
            {t('timeline.opened', {
              person: ticket.requester.displayName ?? t('deletedUser'),
            })}
          </span>
          <time dateTime={ticket.createdAt} className="text-sm text-muted-foreground">
            {format.dateTime(new Date(ticket.createdAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
        </li>
        {items.map((event) => (
          <ActivityEventItem key={event.id} event={event} />
        ))}
      </ol>
      {events.isError && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(events.error)}
        </p>
      )}
      {events.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={events.isFetchingNextPage}
          onClick={() => void events.fetchNextPage()}
        >
          {t('timeline.showMore')}
        </Button>
      )}
    </section>
  );
}
