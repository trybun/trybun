import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { z } from 'zod';
import { RateLimitedNotice } from '../../../../../features/app-shell/components/rate-limited-notice.js';
import { pageTitle } from '../../../../../features/app-shell/page-title.js';
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
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

const paramsSchema = z.object({ projectId: z.uuid() });

/**
 * The read of the page, shared with its metadata in one request: an address that is not a project
 * ID and a project the person cannot see are not found.
 */
const loadProject = cache(async (projectId: string) => {
  const parsed = paramsSchema.safeParse({ projectId });
  if (!parsed.success) {
    notFound();
  }
  await requireSession();
  const client = await getServerApiClient();
  return dataOrNotFound(
    client.GET('/api/v1/projects/{projectId}', {
      params: { path: { projectId: parsed.data.projectId } },
    }),
  );
});

/** A missing or invisible project gets the translated not-found title of the tab (#404). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const [{ projectId }, t] = await Promise.all([params, getTranslations('projects')]);
  return metadataAfterRead(loadProject(projectId), {
    title: (project) => pageTitle(t('settings.title'), project.name),
    rateLimitedTitle: () => pageTitle(t('settings.title')),
  });
}

/**
 * The settings of a project (§3.1, §7.3, §7.4). A project the person cannot see – or an address
 * that is not a project ID – shows the not-found page (§17.2); a person over the rate limit is told
 * so (§14.4).
 */
export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { projectId } = await params;
  const { tab } = projectSettingsSearchParamsSchema.parse(await searchParams);
  const { data: project, rateLimited } = await readOrRateLimited(loadProject(projectId));
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} />;
  }
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
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
