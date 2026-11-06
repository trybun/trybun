import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { MyTicketsList } from '../../../../features/tickets/components/my-tickets-list.js';
import { myTicketsQueryOptions } from '../../../../features/tickets/queries.js';
import { myTicketsSearchParamsSchema } from '../../../../features/tickets/search-params.js';
import { getServerApiClient } from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

/**
 * "My tickets" (§5.7): the tickets the end user requested, across their projects or – with
 * `projectId` in the address – of one project, also archived ones (Q4).
 */
export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = myTicketsSearchParamsSchema.parse(await searchParams);
  await requireSession();
  const [t, client] = await Promise.all([
    getTranslations('portal.myTickets'),
    getServerApiClient(),
  ]);
  const queryClient = getServerQueryClient();
  await queryClient.prefetchInfiniteQuery(myTicketsQueryOptions(client, { projectId }));
  const projectName = queryClient.getQueryData(
    myTicketsQueryOptions(client, { projectId }).queryKey,
  )?.pages[0]?.items[0]?.project.name;
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold break-words">
        {projectId !== undefined && projectName !== undefined
          ? t('projectTitle', { project: projectName })
          : t('title')}
      </h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MyTicketsList projectId={projectId} />
      </HydrationBoundary>
    </div>
  );
}
