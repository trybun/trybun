import type { QueryClientConfig } from '@tanstack/react-query';
import { ApiError } from '../errors/api-error-class.js';

/** The configuration of the TanStack Query clients on the server and in the browser (§18.5). */
export const QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    // Data prefetched on the server is not fetched again right after hydration.
    queries: { staleTime: 60_000 },
  },
};

/**
 * Whether the browser tries a failed read again (§18.5): a refusal – a `4xx`, also a `429` – is an
 * answer, never retried, so its message shows at once and a retry never uses up more of the rate
 * limit (#356, #427); a failure of the server (`5xx`) or the network is tried up to 3 times.
 */
export function retryUnlessRefused(failureCount: number, error: Error): boolean {
  return !(error instanceof ApiError && error.status < 500) && failureCount < 3;
}

/**
 * The configuration of the query client of the browser. The server keeps the default of TanStack
 * Query, no retry, as a failed prefetch is read again by the browser, which shows its error; a
 * read whose failure fails the page passes `retryUnlessRefused` itself (`getTicketPage`,
 * `getPortalProject`).
 */
export const BROWSER_QUERY_CLIENT_CONFIG: QueryClientConfig = {
  ...QUERY_CLIENT_CONFIG,
  defaultOptions: {
    ...QUERY_CLIENT_CONFIG.defaultOptions,
    queries: { ...QUERY_CLIENT_CONFIG.defaultOptions?.queries, retry: retryUnlessRefused },
  },
};
