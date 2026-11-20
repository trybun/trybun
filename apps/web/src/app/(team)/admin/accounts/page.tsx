import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getAdministrator } from '../../../../features/administration/administrator.js';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { pageTitle } from '../../../../features/app-shell/page-title.js';
import { LazyInviteDialog } from '../../../../features/invitations/components/lazy-invite-dialog.js';
import { AccountList } from '../../../../features/users/components/account-list.js';
import { usersQueryOptions } from '../../../../features/users/queries.js';
import { accountsSearchParamsSchema } from '../../../../features/users/search-params.js';
import {
  getServerApiClient,
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../lib/api-client/server-api-client.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

/** A person who is not the Administrator gets the translated not-found title of the tab (#404). */
export async function generateMetadata(): Promise<Metadata> {
  const [t, tAdministration] = await Promise.all([
    getTranslations('users.accounts'),
    getTranslations('administration'),
  ]);
  const title = () => pageTitle(t('title'), tAdministration('title'));
  return metadataAfterRead(getAdministrator(), { title, rateLimitedTitle: title });
}

/**
 * The Accounts page of the Administrator panel (§7.4): every account with its kind, state and the
 * Administrator role, its pending invitations and the actions on it, and **Invite**. Others see the
 * not-found page, as the API answers them with `404`; a person over the rate limit is told so.
 */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { kind, state } = accountsSearchParamsSchema.parse(await searchParams);
  const [t, client, { rateLimited }] = await Promise.all([
    getTranslations('users.accounts'),
    getServerApiClient(),
    readOrRateLimited(getAdministrator()),
  ]);
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  const queryClient = getServerQueryClient();
  // The first page comes with the pending invitations of its accounts, so they are part of the
  // first paint and never push the rows below them down under the finger (#310, Rule 9).
  await queryClient.prefetchInfiniteQuery(usersQueryOptions(client, { kind, state, query: '' }));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">{t('title')}</h2>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <LazyInviteDialog />
      </div>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <AccountList kind={kind} state={state} />
      </HydrationBoundary>
    </div>
  );
}
