import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { CurrentUser } from '@trybun/contracts/users';
import { notFound } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { LazyNewOrganizationDialog } from '../../../../features/organizations/components/lazy-new-organization-dialog.js';
import { OrganizationStateTabs } from '../../../../features/organizations/components/organization-state-tabs.js';
import { organizationsQueryOptions } from '../../../../features/organizations/queries.js';
import { organizationsSearchParamsSchema } from '../../../../features/organizations/search-params.js';
import { currentUserQueryOptions } from '../../../../features/users/queries.js';
import { getServerApiClient } from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { isRateLimited } from '../../../../lib/errors/api-error.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

/**
 * The Organizations page of the Administrator panel (§7.3): the active or archived organizations
 * and New organization. Others see the not-found page, as the API answers them with `404`; a person over the rate limit is
 * told so.
 */
export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { state } = organizationsSearchParamsSchema.parse(await searchParams);
  await requireSession();
  const [t, client] = await Promise.all([getTranslations('organizations'), getServerApiClient()]);
  const queryClient = getServerQueryClient();
  // A read that throws: a failed one is not a missing permission – the rate limit says so, and
  // other errors reach the error page (#356).
  let user: CurrentUser;
  try {
    user = await queryClient.fetchQuery(currentUserQueryOptions(client));
  } catch (error) {
    if (isRateLimited(error)) {
      return <RateLimitedNotice error={error} headingLevel={2} />;
    }
    throw error;
  }
  if (!user.allowedActions.includes('open_administration')) {
    notFound();
  }
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
