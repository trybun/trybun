import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAdministrator } from '../../../../features/administration/administrator.js';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { LazyNewOrganizationDialog } from '../../../../features/organizations/components/lazy-new-organization-dialog.js';
import { OrganizationStateTabs } from '../../../../features/organizations/components/organization-state-tabs.js';
import { organizationsQueryOptions } from '../../../../features/organizations/queries.js';
import { organizationsSearchParamsSchema } from '../../../../features/organizations/search-params.js';
import {
  getServerApiClient,
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../lib/api-client/server-api-client.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

/** A person who is not the Administrator gets the translated not-found title of the tab (#404). */
export function generateMetadata(): Promise<Metadata> {
  return metadataAfterRead(getAdministrator());
}

/**
 * The Organizations page of the Administrator panel (§7.3): the active or archived organizations
 * and New organization. Others see the not-found page, as the API answers them with `404`; a
 * person over the rate limit is told so.
 */
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { state } = organizationsSearchParamsSchema.parse(await searchParams);
  const [t, client, { data: user, rateLimited }] = await Promise.all([
    getTranslations('organizations'),
    getServerApiClient(),
    readOrRateLimited(getAdministrator()),
  ]);
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  const queryClient = getServerQueryClient();
  await queryClient.prefetchInfiniteQuery(organizationsQueryOptions(client, state));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        {user.allowedActions.includes('create_organization') && <LazyNewOrganizationDialog />}
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <OrganizationStateTabs state={state} />
      </HydrationBoundary>
    </div>
  );
}
