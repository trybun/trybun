import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { buttonVariants } from '@trybun/ui/components/button';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { redirect } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { PortalProjectList } from '../../../features/portal/components/portal-project-list.js';
import { myTicketsHref, portalProjectHref } from '../../../features/portal/hrefs.js';
import { projectsQueryOptions } from '../../../features/projects/queries.js';
import { getServerApiClient } from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../lib/query-client/server-query-client.js';

/**
 * The portal root (§5.7, Q4): the active projects of the end user. With exactly one, the server
 * redirects to its project home without rendering the list, so a user with one project lands in it
 * after sign-in; archived projects do not count. Without any, an empty state – with a link to "My
 * tickets" when the user has tickets, e.g. in archived projects.
 */
export default async function PortalRootPage() {
  await requireSession();
  const [t, client] = await Promise.all([getTranslations('portal.root'), getServerApiClient()]);
  const queryClient = getServerQueryClient();
  const options = projectsQueryOptions(client, 'active');
  // Already prefetched by the portal shell for its navigation.
  await queryClient.prefetchInfiniteQuery(options);
  const firstPage = queryClient.getQueryData(options.queryKey)?.pages[0];
  const [onlyProject, ...otherProjects] = firstPage?.items ?? [];
  if (onlyProject !== undefined && otherProjects.length === 0 && firstPage?.nextCursor === null) {
    redirect(portalProjectHref(onlyProject.id));
  }
  if (firstPage !== undefined && onlyProject === undefined) {
    const tickets = await client.GET('/api/v1/tickets', { params: { query: { limit: 1 } } });
    const hasTickets = (tickets.data?.items.length ?? 0) > 0;
    return (
      <div className="flex max-w-prose flex-col gap-3">
        <h1 className="text-2xl font-bold">{t('emptyTitle')}</h1>
        <p className="text-muted-foreground">{t('emptyDescription')}</p>
        {hasTickets && (
          <Link
            href={myTicketsHref()}
            className={cn(buttonVariants({ variant: 'outline' }), 'w-full md:w-fit')}
          >
            {t('myTickets')}
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PortalProjectList />
      </HydrationBoundary>
    </div>
  );
}
