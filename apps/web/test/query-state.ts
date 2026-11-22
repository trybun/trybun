import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { apiErrorOf } from '../src/lib/errors/api-error.js';

/**
 * Seeds the state an infinite query is left in when a later page fails (**Load more**, #434):
 * TanStack Query keeps the pages already loaded and sets the query's status to `error`. For a
 * render-state test on the server; a component test in jsdom presses **Load more** instead, as a
 * mounted query in `error` reads again.
 */
export function seedFailedLaterPage<Page>(
  client: QueryClient,
  queryKey: QueryKey,
  pages: Page[],
  error: Error = apiErrorOf(500, undefined),
) {
  client.setQueryData<InfiniteData<Page, unknown>>(queryKey, {
    pages,
    pageParams: pages.map((_, index) => (index === 0 ? null : `page-${index}`)),
  });
  const query = client.getQueryCache().find({ queryKey, exact: true });
  if (query === undefined) {
    throw new Error(`No query ${JSON.stringify(queryKey)} to fail`);
  }
  query.setState({ status: 'error', error, fetchStatus: 'idle' });
}
