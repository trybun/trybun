import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppShell } from '../../features/app-shell/components/app-shell.js';
import { currentUserQueryOptions } from '../../features/users/queries.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { requireSession } from '../../lib/auth/session.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';

/**
 * The views of the team inside the application shell. The signed-in account is prefetched on the
 * server and hydrated into the query cache of the browser (§18.5).
 */
export default async function TeamLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const queryClient = getServerQueryClient();
  await queryClient.prefetchQuery(currentUserQueryOptions(await getServerApiClient()));
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell>{children}</AppShell>
    </HydrationBoundary>
  );
}
