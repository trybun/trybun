'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { QUERY_CLIENT_CONFIG } from './query-client-config.js';

/** The query cache of the browser: the only client-side store of server data (§18.5). */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient(QUERY_CLIENT_CONFIG));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
