'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { ActivityEventResponse } from '@trybun/contracts/activity-events';
import { type TicketResponse, ticketIdentifier } from '@trybun/contracts/tickets';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { Button } from '@trybun/ui/components/button';
import { Markdown } from '@trybun/ui/components/markdown';
import { ArchiveIcon, ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { MY_TICKETS_HREF } from '../../app-shell/navigation.js';
import { portalTicketHref } from '../../portal/hrefs.js';
import { projectQueryOptions } from '../../projects/queries.js';
import { activityEventsQueryOptions, ticketQueryOptions } from '../queries.js';
import { PublicStatusBadge } from './public-status-badge.js';
import { ResolutionConfirmationPanel } from './resolution-confirmation-panel.js';

/**
 * A ticket in the portal (§3.2, §4.2, §4.5): what an end user may see – the identifier, title,
 * public status with its description, the resolution question while it waits for the requester's
 * answer, the description and the public timeline. The API leaves internal fields and events out of
 * the response; the view only shows what it receives. The data is prefetched on the server.
 */
export function TicketView({ identifier }: { identifier: string }) {
  const t = useTranslations('portal.ticket');
  const tDescriptions = useTranslations('tickets.publicDescriptions');
  const errorMessage = useErrorMessage();
  const ticket = useQuery(ticketQueryOptions(browserApiClient, identifier));
  // The state of the project for its read-only banner; a project the requester lost access to
  // answers `404`, and the ticket stays readable (§7.3).
  const project = useQuery({
    ...projectQueryOptions(browserApiClient, ticket.data?.projectId ?? ''),
    enabled: ticket.data !== undefined,
  });
  if (ticket.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(ticket.error)}
      </p>
    );
  }
  if (ticket.data === undefined) {
    return null;
  }
  const data = ticket.data;
  const description = 'publicStatusDescription' in data ? data.publicStatusDescription : undefined;
  const original =
    data.duplicateOf === null
      ? undefined
      : ticketIdentifier(data.duplicateOf.projectKey, data.duplicateOf.number);
  return (
    <article className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={MY_TICKETS_HREF}
          className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
          {t('back')}
        </Link>
        <p className="font-mono text-sm text-muted-foreground">
          {data.identifier} · {data.project.name}
        </p>
        <h1 className="text-2xl font-bold break-words">{data.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <PublicStatusBadge status={data.publicStatus} />
          {description !== undefined && (
            <span className="text-sm">{tDescriptions(description)}</span>
          )}
        </div>
        {original !== undefined && (
          <p className="text-sm">
            {t.rich('duplicateOf', {
              link: (chunks) => (
                <Link
                  href={portalTicketHref(original)}
                  className="font-medium text-link underline-offset-4 hover:underline"
                >
                  {chunks}
                </Link>
              ),
              identifier: original,
            })}
          </p>
        )}
      </div>
      {data.allowedActions.includes('confirm_resolution') && (
        <ResolutionConfirmationPanel ticketId={data.id} />
      )}
      {project.data?.state === 'archived' && (
        <Alert variant="warning">
          <ArchiveIcon aria-hidden />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      )}
      <section aria-labelledby="ticket-description" className="flex flex-col gap-2">
        <h2 id="ticket-description" className="text-lg font-semibold">
          {t('description')}
        </h2>
        {data.description === '' ? (
          <p className="text-sm text-muted-foreground">{t('noDescription')}</p>
        ) : (
          <Markdown>{data.description}</Markdown>
        )}
      </section>
      <Timeline ticket={data} />
    </article>
  );
}

/**
 * The public timeline (§4.5): the creation as the first item, as on GitHub (S1-05 Q11), then the
 * public events, oldest first – in Stage 1 the public status changes.
 */
function Timeline({ ticket }: { ticket: TicketResponse }) {
  const t = useTranslations('portal.ticket');
  const tStatuses = useTranslations('tickets.publicStatuses');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const events = useInfiniteQuery(activityEventsQueryOptions(browserApiClient, ticket.id));
  const items = events.data?.pages.flatMap((page) => page.items) ?? [];
  const time = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  return (
    <section aria-labelledby="ticket-history" className="flex flex-col gap-3">
      <h2 id="ticket-history" className="text-lg font-semibold">
        {t('history')}
      </h2>
      <ol className="flex flex-col gap-3 border-l border-border pl-4">
        <li className="flex flex-col">
          <span>{t('created')}</span>
          <time dateTime={ticket.createdAt} className="text-sm text-muted-foreground">
            {time(ticket.createdAt)}
          </time>
        </li>
        {items.filter(isStatusChange).map((event) => (
          <li key={event.id} className="flex flex-col">
            <span>{t('statusChanged', { status: tStatuses(publicStatusTo(event)) })}</span>
            <span className="text-sm text-muted-foreground">
              {event.actor === null ? t('system') : (event.actor.displayName ?? t('unknownPerson'))}
              {' · '}
              <time dateTime={event.createdAt}>{time(event.createdAt)}</time>
            </span>
          </li>
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
          {t('loadMoreHistory')}
        </Button>
      )}
    </section>
  );
}

/** A public status change whose data the portal can show: the new public status. */
function isStatusChange(event: ActivityEventResponse): boolean {
  return event.type === 'status_changed' && event.data !== null;
}

function publicStatusTo(event: ActivityEventResponse) {
  const to = event.data?.to;
  return to === 'received' ||
    to === 'awaiting_reply' ||
    to === 'in_progress' ||
    to === 'resolved' ||
    to === 'closed'
    ? to
    : 'received';
}
