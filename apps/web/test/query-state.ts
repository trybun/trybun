import type { InfiniteData, QueryClient, QueryKey } from '@tanstack/react-query';
import { expect } from 'vitest';
import { apiErrorOf } from '../src/lib/errors/api-error.js';

/** The message of the `500` that `seedFailedLaterPage()` fails with (`server.internal_error`). */
export const FAILED_READ_MESSAGE = 'Something went wrong. Try again later.';

/**
 * Seeds the state an infinite query is left in when a later page fails (**Load more**, #434): the
 * pages already loaded with the status `error`. It leaves out the direction of the failed read, so
 * the query reads as `isRefetchError` rather than `isFetchNextPageError` – the lists treat both
 * alike – because with the direction the optimistic refetch of the stale data on mount would read
 * as `isFetchingNextPage`. For a render-state test on the server; a component test in jsdom
 * presses **Load more** instead, as a mounted query reads the stale data again (`refetchOnMount`).
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

/** Asserts that each text occurs in `html`, in this order – e.g. the rows, the alert, the button. */
export function expectInOrder(html: string, ...texts: string[]) {
  const indexes = texts.map((text) => html.indexOf(text));
  expect(indexes).not.toContain(-1);
  expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
}
