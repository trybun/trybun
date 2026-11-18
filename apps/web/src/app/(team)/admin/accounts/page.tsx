import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { CurrentUser } from '@trybun/contracts/users';
import { notFound } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { LazyInviteDialog } from '../../../../features/invitations/components/lazy-invite-dialog.js';
import { AccountList } from '../../../../features/users/components/account-list.js';
import { currentUserQueryOptions, usersQueryOptions } from '../../../../features/users/queries.js';
import { accountsSearchParamsSchema } from '../../../../features/users/search-params.js';
import { getServerApiClient } from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { isRateLimited } from '../../../../lib/errors/api-error.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

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
  await requireSession();
  const [t, client] = await Promise.all([getTranslations('users.accounts'), getServerApiClient()]);
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
