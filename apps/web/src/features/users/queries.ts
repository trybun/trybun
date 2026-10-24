import { queryOptions } from '@tanstack/react-query';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/** The signed-in account (§18.5): prefetched by the application shell, read by its user menu. */
export function currentUserQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['users', 'me'],
    queryFn: ({ signal }) => dataOf(client.GET('/api/v1/users/me', { signal })),
  });
}
