import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { UserKind, UserState } from '@trybun/contracts/users';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

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

/** The accounts of the Accounts page, page by page (§7.4); the Administrator only. */
export function usersQueryOptions(client: ApiClient, filters: AccountFilters) {
  const { kind, state, query } = filters;
  return infiniteQueryOptions({
    queryKey: ['users', 'list', { kind, state, query: query ?? '' }],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
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
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
