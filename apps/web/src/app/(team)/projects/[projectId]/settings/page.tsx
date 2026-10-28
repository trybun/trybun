import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation.js';
import { z } from 'zod';
import { organizationsQueryOptions } from '../../../../../features/organizations/queries.js';
import { ProjectSettings } from '../../../../../features/projects/components/project-settings.js';
import {
  projectMembersQueryOptions,
  projectQueryOptions,
} from '../../../../../features/projects/queries.js';
import { projectSettingsSearchParamsSchema } from '../../../../../features/projects/search-params.js';
import { currentUserQueryOptions } from '../../../../../features/users/queries.js';
import {
  dataOrNotFound,
  getServerApiClient,
} from '../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

const paramsSchema = z.object({ projectId: z.uuid() });

/**
 * The settings of a project (§3.1, §7.3, §7.4). A project the person cannot see – or an address
 * that is not a project ID – shows the not-found page (§17.2).
 */
export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }
  const { projectId } = parsed.data;
  const { tab } = projectSettingsSearchParamsSchema.parse(await searchParams);
  await requireSession();
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
  const project = await dataOrNotFound(
    client.GET('/api/v1/projects/{projectId}', { params: { path: { projectId } } }),
  );
  queryClient.setQueryData(projectQueryOptions(client, projectId).queryKey, project);
  await Promise.all([
    project.allowedActions.includes('read_members')
      ? queryClient.prefetchInfiniteQuery(projectMembersQueryOptions(client, projectId))
      : undefined,
    queryClient.prefetchQuery(currentUserQueryOptions(client)),
  ]);
  // The organizations answer only the Administrator, who administers them (§7.5).
  const canSeeOrganizations =
    queryClient
      .getQueryData(currentUserQueryOptions(client).queryKey)
      ?.allowedActions.includes('create_organization') === true;
  if (canSeeOrganizations) {
    await Promise.all(
      (['active', 'archived'] as const).map((state) =>
        queryClient.prefetchInfiniteQuery(organizationsQueryOptions(client, state, projectId)),
      ),
    );
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectSettings projectId={projectId} tab={tab} canSeeOrganizations={canSeeOrganizations} />
    </HydrationBoundary>
  );
}
