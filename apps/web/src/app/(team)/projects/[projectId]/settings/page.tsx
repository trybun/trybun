import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation.js';
import { z } from 'zod';
import { ProjectSettings } from '../../../../../features/projects/components/project-settings.js';
import {
  projectMembersQueryOptions,
  projectQueryOptions,
} from '../../../../../features/projects/queries.js';
import {
  projectSettingsHref,
  projectSettingsSearchParamsSchema,
} from '../../../../../features/projects/search-params.js';
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
  await requireSession(projectSettingsHref(projectId, tab));
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
  const project = await dataOrNotFound(
    client.GET('/api/v1/projects/{projectId}', { params: { path: { projectId } } }),
  );
  queryClient.setQueryData(projectQueryOptions(client, projectId).queryKey, project);
  if (project.allowedActions.includes('read_members')) {
    await queryClient.prefetchInfiniteQuery(projectMembersQueryOptions(client, projectId));
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectSettings projectId={projectId} tab={tab} />
    </HydrationBoundary>
  );
}
