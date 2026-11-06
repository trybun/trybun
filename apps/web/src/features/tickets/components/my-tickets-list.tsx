'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { TicketResponse } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { portalTicketHref } from '../../portal/hrefs.js';
import { myTicketsQueryOptions } from '../queries.js';
import { PublicStatusBadge } from './public-status-badge.js';

/**
 * "My tickets" (§5.7, Q10): the tickets the person requested, those awaiting their reply first
 * under their own heading, then the others, the most recently updated first. Across projects each
 * item names its project. `limit` shows only the first items, e.g. on the project home, which links
 * to the whole list instead of loading more.
 */
export function MyTicketsList({
  projectId,
  limit,
  emptyAction,
  headingLevel = 2,
}: {
  projectId?: string;
  /** The level of the group headings: 3 inside a section of its own, e.g. on the project home. */
  headingLevel?: 2 | 3;
  limit?: number;
  /** What the empty list offers, e.g. **Create ticket** in a project that takes tickets. */
  emptyAction?: ReactNode;
}) {
  const t = useTranslations('portal.myTickets');
  const errorMessage = useErrorMessage();
  const tickets = useInfiniteQuery(myTicketsQueryOptions(browserApiClient, { projectId, limit }));
  if (tickets.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(tickets.error)}
      </p>
    );
  }
  const items = tickets.data?.pages.flatMap((page) => page.items) ?? [];
  if (tickets.isSuccess && items.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
        {emptyAction}
      </div>
    );
  }
  const awaiting = items.filter((ticket) => ticket.publicStatus === 'awaiting_reply');
  const others = items.filter((ticket) => ticket.publicStatus !== 'awaiting_reply');
  return (
    <div className="flex flex-col gap-6">
      {awaiting.length > 0 && (
        <TicketGroup
          heading={t('awaitingHeading')}
          tickets={awaiting}
          showsProject={projectId === undefined}
          headingLevel={headingLevel}
          isHighlighted
        />
      )}
      {others.length > 0 && (
        <TicketGroup
          heading={awaiting.length > 0 ? t('otherHeading') : undefined}
          tickets={others}
          showsProject={projectId === undefined}
          headingLevel={headingLevel}
        />
      )}
      {limit === undefined && tickets.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={tickets.isFetchingNextPage}
          onClick={() => void tickets.fetchNextPage()}
        >
          {tickets.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </Button>
      )}
    </div>
  );
}

function TicketGroup({
  heading,
  tickets,
  showsProject,
  headingLevel,
  isHighlighted = false,
}: {
  heading: string | undefined;
  tickets: TicketResponse[];
  showsProject: boolean;
  headingLevel: 2 | 3;
  isHighlighted?: boolean;
}) {
  const t = useTranslations('portal.myTickets');
  const format = useFormatter();
  return (
    <section className="flex flex-col gap-2" aria-label={heading}>
      {heading !== undefined &&
        (headingLevel === 2 ? (
          <h2 className="text-lg font-semibold">{heading}</h2>
        ) : (
          <h3 className="text-base font-semibold">{heading}</h3>
        ))}
      <ul className="flex flex-col gap-2">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link
              href={portalTicketHref(ticket.identifier)}
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground hover:bg-muted focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none',
                isHighlighted && 'border-l-4 border-l-warning',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm text-muted-foreground">
                    {ticket.identifier}
                  </span>
                  <PublicStatusBadge status={ticket.publicStatus} />
                </span>
                <span className="font-medium break-words">{ticket.title}</span>
                <span className="text-sm text-muted-foreground">
                  {showsProject && `${ticket.project.name} · `}
                  {t('updated', {
                    time: format.dateTime(new Date(ticket.updatedAt), {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }),
                  })}
                </span>
              </span>
              <ChevronRightIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
