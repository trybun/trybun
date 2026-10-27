import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { getTranslations } from 'next-intl/server';
import { LazyNewProjectDialog } from '../../../features/projects/components/lazy-new-project-dialog.js';
import { ProjectStateTabs } from '../../../features/projects/components/project-state-tabs.js';
import { projectsQueryOptions } from '../../../features/projects/queries.js';
import { projectsSearchParamsSchema } from '../../../features/projects/search-params.js';
import { currentUserQueryOptions } from '../../../features/users/queries.js';
import { getServerApiClient } from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../lib/query-client/server-query-client.js';

/**
 * The Projects page (§7.3): the projects the person can see, active or archived, and – for the
 * Administrator – New project. One list serves every role through `allowedActions` (Rule 2).
 */
export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { state } = projectsSearchParamsSchema.parse(await searchParams);
  await requireSession(state === 'active' ? '/projects' : `/projects?state=${state}`);
  const [t, client] = await Promise.all([getTranslations('projects'), getServerApiClient()]);
  const queryClient = getServerQueryClient();
  await Promise.all([
    queryClient.prefetchInfiniteQuery(projectsQueryOptions(client, state)),
    queryClient.prefetchQuery(currentUserQueryOptions(client)),
  ]);
  const user = queryClient.getQueryData(currentUserQueryOptions(client).queryKey);
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {user?.allowedActions.includes('create_project') === true && <LazyNewProjectDialog />}
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <ProjectStateTabs state={state} />
      </HydrationBoundary>
    </div>
  );
}
