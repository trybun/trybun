import type { QueryClientConfig } from '@tanstack/react-query';

/** The configuration of the TanStack Query clients on the server and in the browser (§18.5). */
export const QUERY_CLIENT_CONFIG: QueryClientConfig = {
  defaultOptions: {
    // Data prefetched on the server is not fetched again right after hydration.
    queries: { staleTime: 60_000 },
  },
};
