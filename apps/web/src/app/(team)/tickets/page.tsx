import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { TicketList } from '../../../features/tickets/components/ticket-list.js';
import { ticketListInfiniteQueryOptions } from '../../../features/tickets/queries.js';
import { parseTicketListSearchParams } from '../../../features/tickets/ticket-list.js';
import { currentUserQueryOptions } from '../../../features/users/queries.js';
import { getServerApiClient } from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../lib/query-client/server-query-client.js';

/**
 * The team's ticket list (§8.1, change specification of S1-13): the tickets of all the person's
 * projects in a predefined view or their own filters, all kept in the URL. Without parameters it
 * opens "My open tickets" (Q9). As a list it uses the full width of the content area (§2.9).
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const state = parseTicketListSearchParams(await searchParams);
  await requireSession();
  const [t, client] = await Promise.all([getTranslations('tickets.list'), getServerApiClient()]);
  const queryClient = getServerQueryClient();
  await Promise.all([
    queryClient.prefetchInfiniteQuery(ticketListInfiniteQueryOptions(client, state)),
    queryClient.prefetchQuery(currentUserQueryOptions(client)),
  ]);
  const user = queryClient.getQueryData(currentUserQueryOptions(client).queryKey);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        {/* A new address renders new results, which clears the selection (S1-13 Q17); the filter
            bar stays, so an open picker stays open (#279). */}
        <TicketList
          state={state}
          currentUserId={user?.id ?? ''}
          organizationsExist={user?.organizationsExist === true}
        />
      </HydrationBoundary>
    </div>
  );
}
