import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { organizationParamsSchema } from '@trybun/contracts/organizations';
import { notFound } from 'next/navigation.js';
import { OrganizationDetail } from '../../../../../features/organizations/components/organization-detail.js';
import {
  organizationMembersQueryOptions,
  organizationQueryOptions,
} from '../../../../../features/organizations/queries.js';
import { projectsQueryOptions } from '../../../../../features/projects/queries.js';
import {
  dataOrNotFound,
  getServerApiClient,
} from '../../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

/**
 * An organization in the Administrator panel (§7.3). An organization that does not exist – or an
 * address that is not an organization ID, or a person who is not the Administrator – shows the
 * not-found page (§17.2).
 */
export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const parsed = organizationParamsSchema.safeParse(await params);
  if (!parsed.success) {
    notFound();
  }
  const { organizationId } = parsed.data;
  await requireSession();
  const client = await getServerApiClient();
  const queryClient = getServerQueryClient();
  const organization = await dataOrNotFound(
    client.GET('/api/v1/organizations/{organizationId}', {
      params: { path: { organizationId } },
    }),
  );
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
