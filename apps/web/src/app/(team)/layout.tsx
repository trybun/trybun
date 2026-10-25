import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { AppShell } from '../../features/app-shell/components/app-shell.js';
import { LazyHelpMenu } from '../../features/help/components/lazy-help-menu.js';
import { getHelpViews } from '../../features/help/help-content.js';
import { getHelpReaderKind } from '../../features/help/reader.js';
import { LazyProductTourMenuItems } from '../../features/product-tours/components/lazy-product-tour-menu-items.js';
import { ProductTourProvider } from '../../features/product-tours/components/product-tour-provider.js';
import { productTourProgressQueryOptions } from '../../features/product-tours/queries.js';
import { currentUserQueryOptions } from '../../features/users/queries.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { requireSession } from '../../lib/auth/session.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';

/**
 * The views of the team inside the application shell. The signed-in account and its product tour
 * progress are prefetched on the server and hydrated into the query cache of the browser (§18.5);
 * the account kind decides the contextual help of the help menu (§2.3) and the tours (§2.4).
 */
export default async function TeamLayout({ children }: { children: ReactNode }) {
  await requireSession();
  const queryClient = getServerQueryClient();
  const client = await getServerApiClient();
  await Promise.all([
    queryClient.prefetchQuery(currentUserQueryOptions(client)),
    queryClient.prefetchQuery(productTourProgressQueryOptions(client)),
  ]);
  const helpViews = getHelpViews(await getHelpReaderKind());
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProductTourProvider>
        <AppShell
          help={
            <LazyHelpMenu views={helpViews}>
              <LazyProductTourMenuItems />
            </LazyHelpMenu>
          }
        >
          {children}
        </AppShell>
      </ProductTourProvider>
    </HydrationBoundary>
  );
}
