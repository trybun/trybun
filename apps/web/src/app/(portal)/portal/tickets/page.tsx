import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { newTicketHref } from '../../../../features/portal/hrefs.js';
import { projectQueryOptions } from '../../../../features/projects/queries.js';
import { MyTicketsList } from '../../../../features/tickets/components/my-tickets-list.js';
import { myTicketsQueryOptions } from '../../../../features/tickets/queries.js';
import { myTicketsSearchParamsSchema } from '../../../../features/tickets/search-params.js';
import { getServerApiClient } from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

/**
 * "My tickets" (§5.7): the tickets the end user requested, across their projects or – with
 * `projectId` in the address – of one project, also archived ones (Q4). An empty list of a project
 * that takes tickets offers **Create ticket**.
 */
export default async function MyTicketsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = myTicketsSearchParamsSchema.parse(await searchParams);
  await requireSession();
  const [t, tProject, client] = await Promise.all([
    getTranslations('portal.myTickets'),
    getTranslations('portal.projectHome'),
    getServerApiClient(),
  ]);
  const queryClient = getServerQueryClient();
  const projectOptions = projectQueryOptions(client, projectId ?? '');
  await Promise.all([
    queryClient.prefetchInfiniteQuery(myTicketsQueryOptions(client, { projectId })),
    projectId === undefined ? undefined : queryClient.prefetchQuery(projectOptions),
  ]);
  // The project of the filter, unless the person can no longer read it.
  const project =
    projectId === undefined ? undefined : queryClient.getQueryData(projectOptions.queryKey);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-bold break-words">
        {project === undefined ? t('title') : t('projectTitle', { project: project.name })}
      </h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MyTicketsList
          projectId={projectId}
          emptyAction={
            project?.allowedActions.includes('create_ticket') === true ? (
              <Link
                href={newTicketHref(project.id)}
                className={cn(buttonVariants(), 'w-full md:w-fit')}
              >
                {tProject('createTicket')}
              </Link>
            ) : undefined
          }
        />
      </HydrationBoundary>
    </div>
  );
}
