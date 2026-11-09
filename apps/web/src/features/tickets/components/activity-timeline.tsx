'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Ticket } from '@trybun/contracts/tickets';
import { Field, FieldLabel } from '@trybun/ui/components/field';
import { Switch } from '@trybun/ui/components/switch';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useUpdateCurrentUser } from '../../users/mutations.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { TimelineList } from '../../comments/components/timeline-list.js';
import { timelineQueryOptions } from '../../comments/queries.js';
import { ActivityEventItem } from './activity-event-item.js';

/**
 * The team's timeline of a ticket (§4.5, Q13, S1-12 Q11): "{requester} opened the ticket" from its
 * creation time as the first item – no event records the creation – then the comments, internal
 * notes and events, internal and public, oldest first, 50 per page with **Show more** at the end,
 * and the comment field.
 *
 * **Hide events** is a setting of the account (Q5), so it follows the person to every device; it
 * changes at once and returns when saving fails; it waits for the server's answer before the
 * next change. While it is on, the timeline holds only the comments.
 */
export function ActivityTimeline({
  ticket,
  attachmentMaxSizeMb,
}: {
  ticket: Ticket;
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('tickets');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const user = useQuery(currentUserQueryOptions(browserApiClient));
  const updateCurrentUser = useUpdateCurrentUser();
  const queryClient = useQueryClient();
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
              // One change at a time: a later answer never overwrites a newer choice.
              disabled={updateCurrentUser.isPending}
              onCheckedChange={(checked) =>
                updateCurrentUser.mutate(
                  { hideTimelineEvents: checked },
                  {
                    onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
                    // The API decides what the timeline holds with the stored setting (§4.5).
                    onSettled: () =>
                      queryClient.invalidateQueries({
                        queryKey: timelineQueryOptions(browserApiClient, ticket.id).queryKey,
                      }),
                  },
                )
              }
            />
            <FieldLabel>{t('timeline.hideEvents')}</FieldLabel>
          </Field>
        )}
      </div>
      {isHidden && <p className="text-sm text-muted-foreground">{t('timeline.eventsHidden')}</p>}
      {/* The setting is prefetched with the page; the timeline waits for it. */}
      {!user.isPending && (
        <TimelineList
          ticket={ticket}
          isTeam
          attachmentMaxSizeMb={attachmentMaxSizeMb}
          showMoreLabel={t('timeline.showMore')}
          opening={
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
          }
          // The events leave at once; the timeline is read again once the setting is stored.
          renderEvent={(event) =>
            isHidden ? null : <ActivityEventItem key={event.id} event={event} />
          }
        />
      )}
    </section>
  );
}
