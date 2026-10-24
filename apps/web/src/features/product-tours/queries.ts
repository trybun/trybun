import { queryOptions } from '@tanstack/react-query';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/** The product tours the signed-in person completed or skipped (§2.4), prefetched by the shell. */
export function productTourProgressQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['product-tours', 'progress'],
    queryFn: ({ signal }) =>
      dataOf(client.GET('/api/v1/users/me/product-tours', { signal })).then(({ items }) => items),
  });
}
