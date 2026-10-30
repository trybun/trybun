import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { notFound } from 'next/navigation.js';
import { getTranslations } from 'next-intl/server';
import { LazyInviteDialog } from '../../../../features/invitations/components/lazy-invite-dialog.js';
import { AccountList } from '../../../../features/users/components/account-list.js';
import { currentUserQueryOptions, usersQueryOptions } from '../../../../features/users/queries.js';
import { accountsSearchParamsSchema } from '../../../../features/users/search-params.js';
import { getServerApiClient } from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';
import { getServerQueryClient } from '../../../../lib/query-client/server-query-client.js';

/**
 * The Accounts page of the Administrator panel (§7.4): every account with its kind, state and the
 * Administrator role, its pending invitations and the actions on it, and **Invite**. Others see the
 * not-found page, as the API answers them with `404`.
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
  await queryClient.prefetchQuery(currentUserQueryOptions(client));
  const user = queryClient.getQueryData(currentUserQueryOptions(client).queryKey);
  if (user?.allowedActions.includes('open_administration') !== true) {
    notFound();
  }
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
