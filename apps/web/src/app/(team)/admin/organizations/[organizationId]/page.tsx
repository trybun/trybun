import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { organizationParamsSchema } from '@trybun/contracts/organizations';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation.js';
import { cache } from 'react';
import { RateLimitedNotice } from '../../../../../features/app-shell/components/rate-limited-notice.js';
import { OrganizationDetail } from '../../../../../features/organizations/components/organization-detail.js';
import {
  organizationMembersQueryOptions,
  organizationQueryOptions,
} from '../../../../../features/organizations/queries.js';
import { projectsQueryOptions } from '../../../../../features/projects/queries.js';
import {
  dataOrNotFound,
  getServerApiClient,
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

/**
 * The read of the page, shared with its metadata in one request: an address that is not an
 * organization ID, an organization that does not exist and a person who is not the Administrator
 * are not found.
 */
const loadOrganization = cache(async (organizationId: string) => {
  const parsed = organizationParamsSchema.safeParse({ organizationId });
  if (!parsed.success) {
    notFound();
  }
  await requireSession();
  const client = await getServerApiClient();
  return dataOrNotFound(
    client.GET('/api/v1/organizations/{organizationId}', {
      params: { path: { organizationId: parsed.data.organizationId } },
    }),
  );
});

/** A missing organization gets the translated not-found title of the tab (#404). */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}): Promise<Metadata> {
  return metadataAfterRead(loadOrganization((await params).organizationId));
}

/**
 * An organization in the Administrator panel (§7.3). An organization that does not exist – or an
 * address that is not an organization ID, or a person who is not the Administrator – shows the
 * not-found page (§17.2); a person over the rate limit is told so (§14.4).
 */
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const { data: organization, rateLimited } = await readOrRateLimited(
    loadOrganization(organizationId),
  );
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
  queryClient.setQueryData(organizationQueryOptions(client, organizationId).queryKey, organization);
  await Promise.all([
    queryClient.prefetchInfiniteQuery(organizationMembersQueryOptions(client, organizationId)),
    organization.allowedActions.includes('manage_projects')
      ? queryClient.prefetchInfiniteQuery(projectsQueryOptions(client, 'active'))
      : undefined,
  ]);
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <OrganizationDetail organizationId={organizationId} />
    </HydrationBoundary>
  );
}
