import 'server-only';
import { ticketIdentifierSchema } from '@trybun/contracts/tickets';
import { notFound } from 'next/navigation.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';
import { activityEventsQueryOptions, ticketQueryOptions } from './queries.js';

/**
 * The ticket of a portal page by the identifier in its address, prefetched for the browser with its
 * timeline (§18.5), so the first paint has the content (§2.9). A ticket the reader cannot see is
 * answered like a missing one, and the page is not found (§5.3).
 */
export async function getPortalTicket(identifier: string) {
  if (!ticketIdentifierSchema.safeParse(identifier).success) {
    notFound();
  }
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
  const options = ticketQueryOptions(client, identifier);
  await queryClient.prefetchQuery(options);
  const error = queryClient.getQueryState(options.queryKey)?.error;
  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }
  const ticket = queryClient.getQueryData(options.queryKey);
  if (ticket === undefined) {
    throw error ?? new Error('The ticket could not be read');
  }
  await queryClient.prefetchInfiniteQuery(activityEventsQueryOptions(client, ticket.id));
  return ticket;
}
