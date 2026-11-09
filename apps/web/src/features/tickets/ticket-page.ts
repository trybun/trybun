import 'server-only';
import { ticketIdentifierSchema } from '@trybun/contracts/tickets';
import { notFound, redirect } from 'next/navigation.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';
import type { Shell } from '../app-shell/counterparts.js';
import { referencedAttachmentIds } from '../attachments/markdown-references.js';
import { portalTicketHref } from '../portal/hrefs.js';
import { attachmentsQueryOptions, ticketAttachmentsQueryOptions } from '../attachments/queries.js';
import { projectQueryOptions } from '../projects/queries.js';
import { currentUserQueryOptions } from '../users/queries.js';
import { ticketHref } from './hrefs.js';
import { timelineQueryOptions } from '../comments/queries.js';
import { ticketQueryOptions } from './queries.js';

/**
 * The ticket of a ticket page – the team ticket view or the portal's – by the identifier in its
 * address, prefetched for the browser with its timeline, its attachments, the images its
 * description references and the state of its project (§18.5), so the first paint has the content
 * and its images (§2.9). The team view also gets the current account, whose **Hide events** keeps
 * only the comments in the timeline (§4.5). A lower-case identifier – typed, or forwarded from the counterpart of
 * the other shell – goes to its canonical upper-case form first, at `canonicalHref` (by default the
 * ticket page of the shell), because the identifier schema accepts only upper case. A ticket the
 * reader cannot see is answered like a missing one, and the page is not found (§5.3).
 */
export async function getTicketPage(
  identifier: string,
  shell: Shell,
  canonicalHref: (canonical: string) => string = shell === 'team' ? ticketHref : portalTicketHref,
) {
  const canonical = identifier.toUpperCase();
  if (canonical !== identifier) {
    redirect(canonicalHref(canonical));
  }
  if (!ticketIdentifierSchema.safeParse(identifier).success) {
    notFound();
  }
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
  const options = ticketQueryOptions(client, identifier);
  const userOptions = currentUserQueryOptions(client);
  await Promise.all([
    queryClient.prefetchQuery(options),
    shell === 'team' ? queryClient.prefetchQuery(userOptions) : undefined,
  ]);
  const error = queryClient.getQueryState(options.queryKey)?.error;
  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }
  const ticket = queryClient.getQueryData(options.queryKey);
  if (ticket === undefined) {
    throw error ?? new Error('The ticket could not be read');
  }
  const imageIds = referencedAttachmentIds(ticket.description);
  await Promise.all([
    // Comments and events in one list; with **Hide events** the API returns the comments only.
    queryClient.prefetchInfiniteQuery(timelineQueryOptions(client, ticket.id)),
    queryClient.prefetchInfiniteQuery(ticketAttachmentsQueryOptions(client, ticket.id)),
    imageIds.length === 0
      ? undefined
      : queryClient.prefetchQuery(attachmentsQueryOptions(client, imageIds)),
    // The state of the project for the read-only banner; `404` when the requester lost access to
    // the project, which keeps the ticket readable (§7.3) and shows no banner.
    queryClient.prefetchQuery(projectQueryOptions(client, ticket.projectId)),
  ]);
  return ticket;
}
