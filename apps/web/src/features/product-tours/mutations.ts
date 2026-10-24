import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ProductTourId,
  ProductTourProgress,
  RecordProductTourProgressDto,
} from '@trybun/contracts/product-tours';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { productTourProgressQueryOptions } from './queries.js';

/**
 * Records how the person ended a tour (§2.4). The progress has no version, so the request sends no
 * `If-Match` (§17.2); the recorded progress replaces the tour's entry in the query cache. A failure
 * shows no message: the tour may start once more on a later visit, which never blocks work.
 */
export function useRecordProductTourProgress() {
  const queryClient = useQueryClient();
  const { queryKey } = productTourProgressQueryOptions(browserApiClient);
  return useMutation({
    mutationFn: ({ tourId, ...body }: RecordProductTourProgressDto & { tourId: ProductTourId }) =>
      dataOf(
        browserApiClient.PUT('/api/v1/users/me/product-tours/{tourId}', {
          params: { path: { tourId } },
          body,
        }),
      ),
    onSuccess: (recorded: ProductTourProgress) => {
      queryClient.setQueryData(queryKey, (progress = []) => [
        ...progress.filter((item) => item.tourId !== recorded.tourId),
        recorded,
      ]);
    },
  });
}
