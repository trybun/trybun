import { queryOptions } from '@tanstack/react-query';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/** Whether the first-run wizard is available (§15.6), e.g. for the note of the sign-in page. */
export function setupQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['setup'],
    queryFn: ({ signal }) => dataOf(client.GET('/api/v1/setup', { signal })),
  });
}

/**
 * The check of the token of the setup link before the wizard shows its form. It changes nothing,
 * so it is read as a query; an invalid token is an answer, not a failure to retry.
 */
export function setupTokenVerificationQueryOptions(client: ApiClient, token: string) {
  return queryOptions({
    queryKey: ['setup', 'token-verification', token],
    queryFn: ({ signal }) =>
      dataOf(client.POST('/api/v1/setup/token-verification', { body: { token }, signal })),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
