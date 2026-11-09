'use client';

import { useQuery } from '@tanstack/react-query';
import type { ActivityEventResponse } from '@trybun/contracts/activity-events';
import {
  type TicketPublicStatus,
  type TicketResponse,
  ticketIdentifier,
  ticketPublicStatusSchema,
} from '@trybun/contracts/tickets';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { ArchiveIcon, ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { MY_TICKETS_HREF } from '../../app-shell/navigation.js';
import { TicketAttachments } from '../../attachments/components/ticket-attachments.js';
import { useTicketImageIds } from '../../attachments/use-ticket-image-ids.js';
import { portalTicketHref } from '../../portal/hrefs.js';
import { projectQueryOptions } from '../../projects/queries.js';
import { TimelineList } from '../../comments/components/timeline-list.js';
import { ticketQueryOptions } from '../queries.js';
import { TicketDescription } from './ticket-description.js';
import { TicketTitle } from './ticket-title.js';
import { PortalVisibility } from './portal-visibility.js';
import { PublicStatusBadge } from './public-status-badge.js';
import { ResolutionConfirmationPanel } from './resolution-confirmation-panel.js';

/**
 * A ticket in the portal (§3.2, §4.2, §4.5): what an end user may see – the identifier, title,
 * public status with its description, its visibility (S1-11), the resolution question while it
 * waits for the requester's answer, the description with its images, the attachments and the
 * public timeline. The API leaves
 * internal fields and events out of the response; the view only shows what it receives. The data
 * is prefetched on the server.
 */
export function TicketView({
  identifier,
  attachmentMaxSizeMb,
}: {
  identifier: string;
  /** `TRYBUN_ATTACHMENT_MAX_SIZE_MB` of the web server (§13.3). */
  attachmentMaxSizeMb: number;
}) {
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
  const imageIds = useTicketImageIds(ticket.data?.id ?? '', ticket.data?.description ?? '');
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
        <TicketTitle ticket={data} />
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
      <PortalVisibility ticket={data} />
      {data.allowedActions.includes('confirm_resolution') && (
        <ResolutionConfirmationPanel ticketId={data.id} />
      )}
      {project.data?.state === 'archived' && (
        <Alert variant="warning">
          <ArchiveIcon aria-hidden />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      )}
      <TicketDescription
        ticket={data}
        imageIds={imageIds}
        attachmentMaxSizeMb={attachmentMaxSizeMb}
      />
      <TicketAttachments ticketId={data.id} />
      <Timeline ticket={data} attachmentMaxSizeMb={attachmentMaxSizeMb} />
    </article>
  );
}

/**
 * The public timeline (§4.5): the creation by the requester – their name, or "Customer" when the
 * identity rule hides it (§5.4) – as the first item, as on GitHub (S1-05 Q11), then the public
 * events, oldest first – in Stage 1 the public status changes, the files added to or deleted from
 * the ticket (S1-08 Q15) and "Shared with everyone" (§5.2, S1-11).
 */
function Timeline({
  ticket,
  attachmentMaxSizeMb,
}: {
  ticket: TicketResponse;
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('portal.ticket');
  const tStatuses = useTranslations('tickets.publicStatuses');
  const format = useFormatter();
  const time = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: 'medium', timeStyle: 'short' });
  const renderEvent = (event: ActivityEventResponse) => {
    // No actor: the system, or a customer the identity rule hides (§5.4, S1-11 Q9).
    const actor =
      event.actor === null
        ? event.automaticSource === null
          ? t('customer')
          : t('system')
        : (event.actor.displayName ?? t('unknownPerson'));
    if (event.type === 'sharing_approved') {
      return (
        <li key={event.id} className="flex flex-col">
          <span>{t('sharedWithEveryone')}</span>
          <time dateTime={event.createdAt} className="text-sm text-muted-foreground">
            {time(event.createdAt)}
          </time>
        </li>
      );
    }
    if (isStatusChange(event)) {
      return (
        <li key={event.id} className="flex flex-col">
          <span>{t('statusChanged', { status: tStatuses(publicStatusTo(event)) })}</span>
          <span className="text-sm text-muted-foreground">
            {actor}
            {' · '}
            <time dateTime={event.createdAt}>{time(event.createdAt)}</time>
          </span>
        </li>
      );
    }
    const file = attachmentFileNameOf(event);
    if (file === undefined) {
      return null;
    }
    return (
      <li key={event.id} className="flex flex-col">
        <span className="break-words">
          {t(event.type === 'attachment_added' ? 'attachmentAdded' : 'attachmentDeleted', {
            person: actor,
            file,
          })}
        </span>
        <time dateTime={event.createdAt} className="text-sm text-muted-foreground">
          {time(event.createdAt)}
        </time>
      </li>
    );
  };
  return (
    <section aria-labelledby="ticket-history" className="flex flex-col gap-3">
      <h2 id="ticket-history" className="text-lg font-semibold">
        {t('history')}
      </h2>
      <TimelineList
        ticket={ticket}
        isTeam={false}
        attachmentMaxSizeMb={attachmentMaxSizeMb}
        showMoreLabel={t('loadMoreHistory')}
        renderEvent={renderEvent}
        opening={
          <li className="flex flex-col">
            <span>
              {t('created', {
                // The requester under the identity rule: "Customer" when the API hides them (§5.4).
                person:
                  ticket.requester === null
                    ? t('customer')
                    : (ticket.requester.displayName ?? t('unknownPerson')),
              })}
            </span>
            <time dateTime={ticket.createdAt} className="text-sm text-muted-foreground">
              {time(ticket.createdAt)}
            </time>
          </li>
        }
      />
    </section>
  );
}

/** A public status change whose data the portal can show: the new public status. */
function isStatusChange(event: ActivityEventResponse): boolean {
  return event.type === 'status_changed' && event.data !== null;
}

/** The file name of an added or deleted file: the snapshot of the attachment (S1-08 Q9). */
function attachmentFileNameOf(event: ActivityEventResponse): string | undefined {
  const data = event.data !== null && 'from' in event.data ? event.data : null;
  const snapshot =
    event.type === 'attachment_added'
      ? data?.to
      : event.type === 'attachment_deleted'
        ? data?.from
        : undefined;
  return typeof snapshot === 'object' && snapshot !== null && 'displayName' in snapshot
    ? (snapshot.displayName ?? undefined)
    : undefined;
}

function publicStatusTo(event: ActivityEventResponse): TicketPublicStatus {
  // The response is a union whose team arm carries any status code; the portal receives public ones.
  const data = event.data !== null && 'to' in event.data ? event.data : null;
  return ticketPublicStatusSchema.catch('received').parse(data?.to);
}
