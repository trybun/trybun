'use client';

import { useQuery } from '@tanstack/react-query';
import type { Ticket, TicketResponse } from '@trybun/contracts/tickets';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { Button } from '@trybun/ui/components/button';
import { Markdown } from '@trybun/ui/components/markdown';
import { toast } from '@trybun/ui/components/toast';
import { ArchiveIcon, CopyIcon } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { TicketAttachments } from '../../attachments/components/ticket-attachments.js';
import { useTicketImageIds } from '../../attachments/use-ticket-image-ids.js';
import { projectQueryOptions } from '../../projects/queries.js';
import { ticketQueryOptions } from '../queries.js';
import { ActivityTimeline } from './activity-timeline.js';
import { TicketFieldPanel } from './ticket-field-panel.js';

/** The team's shape of a ticket response (§3.2); the API sends it to every team account. */
function isTeamTicket(ticket: TicketResponse): ticket is Ticket {
  return 'status' in ticket;
}

/**
 * A ticket in the team ticket view (§3.2, §4.5): the header with the identifier, the title and who
 * opened it when and through which source, the rendered description with its images, the
 * attachments (S1-08), the field panel and the activity timeline. Two columns from the `lg`
 * breakpoint; below it the field panel is the **Details** section after the header (Rule 9). In
 * an archived project the API allows only reading, and the view says so (S1-01). The data is
 * prefetched on the server.
 */
export function TeamTicketView({ identifier }: { identifier: string }) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const ticket = useQuery(ticketQueryOptions(browserApiClient, identifier));
  const project = useQuery({
    ...projectQueryOptions(browserApiClient, ticket.data?.projectId ?? ''),
    enabled: ticket.data !== undefined,
  });
  const imageIds = useTicketImageIds(ticket.data?.id ?? '', ticket.data?.description ?? '');
  if (ticket.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(ticket.error)}
      </p>
    );
  }
  if (ticket.data === undefined || !isTeamTicket(ticket.data)) {
    return null;
  }
  const data = ticket.data;
  return (
    <article className="flex max-w-3xl flex-col gap-6 lg:grid lg:max-w-none lg:grid-cols-[minmax(0,48rem)_18rem] lg:items-start lg:gap-x-8">
      <TicketHeader ticket={data} />
      <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
        <TicketFieldPanel ticket={data} />
      </div>
      <div className="flex flex-col gap-6 lg:col-start-1">
        {project.data?.state === 'archived' && (
          <Alert variant="warning">
            <ArchiveIcon aria-hidden />
            <AlertDescription>{t('view.archivedBanner')}</AlertDescription>
          </Alert>
        )}
        <section aria-labelledby="ticket-description" className="flex flex-col gap-2">
          <h2 id="ticket-description" className="text-lg font-semibold">
            {t('view.description')}
          </h2>
          {data.description === '' ? (
            <p className="text-sm text-muted-foreground">{t('view.noDescription')}</p>
          ) : (
            <Markdown attachmentImageIds={imageIds}>{data.description}</Markdown>
          )}
        </section>
        <TicketAttachments ticketId={data.id} />
        <ActivityTimeline ticket={data} />
      </div>
    </article>
  );
}

/**
 * The identifier with **Copy**, the title and "{requester} opened {relative time}" with the source
 * of the ticket (§3.2). The relative time is rendered again in the browser, so the server's
 * slightly earlier text is not a hydration error.
 */
function TicketHeader({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const format = useFormatter();
  const now = useNow();
  const copy = () =>
    navigator.clipboard.writeText(ticket.identifier).then(
      () =>
        toast.add({
          title: t('view.identifierCopied', { identifier: ticket.identifier }),
          type: 'success',
        }),
      () => toast.add({ title: t('view.copyFailed'), type: 'error' }),
    );
  return (
    <header className="flex flex-col gap-2 lg:col-start-1">
      <div className="flex items-center gap-1">
        <p className="font-mono text-sm text-muted-foreground">{ticket.identifier}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t('view.copyIdentifier', { identifier: ticket.identifier })}
          onClick={() => void copy()}
        >
          <CopyIcon aria-hidden />
        </Button>
      </div>
      <h1 className="text-2xl font-bold break-words">{ticket.title}</h1>
      <p className="text-sm text-muted-foreground">
        {t.rich('view.opened', {
          requester: ticket.requester.displayName ?? t('deletedUser'),
          relativeTime: format.relativeTime(new Date(ticket.createdAt), now),
          time: (chunks) => (
            <time
              dateTime={ticket.createdAt}
              title={format.dateTime(new Date(ticket.createdAt), {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              suppressHydrationWarning
            >
              {chunks}
            </time>
          ),
        })}
        {' · '}
        {t(`sources.${ticket.source}`)}
      </p>
    </header>
  );
}
