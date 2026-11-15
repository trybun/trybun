import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { UserKind, UserState } from '@trybun/contracts/users';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';
import { hasPendingInvitations, userInvitationsQueryOptions } from '../invitations/queries.js';

/** The signed-in account (§18.5): prefetched by the application shell, read by its user menu. */
export function currentUserQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['users', 'me'],
    queryFn: ({ signal }) => dataOf(client.GET('/api/v1/users/me', { signal })),
  });
}

/** The filters of the Accounts page: kind and state (URL state) and the search text. */
export interface AccountFilters {
  kind?: UserKind;
  state?: UserState;
  query?: string;
}

/**
 * The accounts of the Accounts page, page by page (§7.4); the Administrator only. Each page comes
 * with the pending invitations of its accounts (`hasPendingInvitations`): the query function loads
 * them into the cache before it returns the page, so an account is shown with its invitations and
 * never grows under the rows after it – in the first paint, where the server prefetches the first
 * page, and for the pages of **Load more** and of a search alike (#310, Rule 9). A failed
 * invitation request does not fail the page: `AccountInvitations` then reads it itself.
 */
export function usersQueryOptions(client: ApiClient, filters: AccountFilters) {
  const { kind, state, query } = filters;
  return infiniteQueryOptions({
    queryKey: ['users', 'list', { kind, state, query: query ?? '' }],
    queryFn: async ({ pageParam, signal, client: queryClient }) => {
      const page = await dataOf(
        client.GET('/api/v1/users', {
          params: {
            query: {
              ...(kind === undefined ? {} : { kind }),
              ...(state === undefined ? {} : { state }),
              ...(query === undefined || query === '' ? {} : { query }),
              ...(pageParam === null ? {} : { cursor: pageParam }),
            },
          },
          signal,
        }),
      );
      await Promise.all(
        page.items
          .filter(hasPendingInvitations)
          .map((user) =>
            queryClient.prefetchInfiniteQuery(userInvitationsQueryOptions(client, user.id)),
          ),
      );
      return page;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
