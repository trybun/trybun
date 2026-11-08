'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { Ticket } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldLabel } from '@trybun/ui/components/field';
import { Switch } from '@trybun/ui/components/switch';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useUpdateCurrentUser } from '../../users/mutations.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { activityEventsQueryOptions } from '../queries.js';
import { ActivityEventItem } from './activity-event-item.js';

/**
 * The team's activity timeline of a ticket (§4.5, Q13): "{requester} opened the ticket" from its
 * creation time as the first item – no event records the creation – then every event the API
 * returns, internal and public, oldest first, 50 per page with **Show more** at the end.
 *
 * **Hide events** is a setting of the account (Q5), so it follows the person to every device; it
 * changes at once and returns when saving fails. While it is on, the events are not requested.
 */
export function ActivityTimeline({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const user = useQuery(currentUserQueryOptions(browserApiClient));
  const updateCurrentUser = useUpdateCurrentUser();
  const isHidden = user.data?.hideTimelineEvents === true;
  return (
    <section aria-labelledby="ticket-activity" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="ticket-activity" className="text-lg font-semibold">
          {t('timeline.title')}
        </h2>
        {user.data !== undefined && (
          <Field orientation="horizontal" className="w-fit">
            <Switch
              checked={isHidden}
              onCheckedChange={(checked) =>
                updateCurrentUser.mutate(
                  { hideTimelineEvents: checked },
                  { onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }) },
                )
              }
            />
            <FieldLabel>{t('timeline.hideEvents')}</FieldLabel>
          </Field>
        )}
      </div>
      {/* The setting is prefetched with the page; the events wait for it, so none are requested
          while they are hidden. */}
      {user.isPending ? null : isHidden ? (
        <p className="text-sm text-muted-foreground">{t('timeline.eventsHidden')}</p>
      ) : (
        <Events ticket={ticket} />
      )}
    </section>
  );
}

/** The opening item and the events of the ticket, page by page. */
function Events({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const events = useInfiniteQuery(activityEventsQueryOptions(browserApiClient, ticket.id));
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
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
    </>
  );
}
