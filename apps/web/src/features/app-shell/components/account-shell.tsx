import 'server-only';
import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import type { UserKind } from '@trybun/contracts/users';
import { headers } from 'next/headers.js';
import { redirect } from 'next/navigation.js';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';
import { REQUEST_PATH_HEADER } from '../../../lib/auth/callback-path.js';
import { getServerApiClient } from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { pickClientMessages } from '../../../lib/i18n/messages.js';
import { getServerQueryClient } from '../../../lib/query-client/server-query-client.js';
import { LazyHelpMenu } from '../../help/components/lazy-help-menu.js';
import { getHelpViews } from '../../help/help-content.js';
import { LazyProductTourMenuItems } from '../../product-tours/components/lazy-product-tour-menu-items.js';
import { ProductTourProvider } from '../../product-tours/components/product-tour-provider.js';
import { productTourProgressQueryOptions } from '../../product-tours/queries.js';
import { projectsQueryOptions } from '../../projects/queries.js';
import { AccountDeactivatedNotice } from '../../sessions/components/account-deactivated-notice.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { counterpartOf, type Shell } from '../counterparts.js';
import { isNavigationCollapsed } from '../navigation-cookie.js';
import type { NavigationContext } from '../navigation.js';
import { AppShell } from './app-shell.js';

/** The side of the web application an account kind works in (§5.7). */
export function shellOf(kind: UserKind): Shell {
  return kind === 'end_user' ? 'portal' : 'team';
}

/**
 * The application shell of the signed-in account (§2.9, §5.7): the team's views or the end-user
 * portal. The account, its product tour progress and – in the portal – its active projects are
 * prefetched on the server and hydrated into the query cache of the browser (§18.5). The account
 * kind decides the side: an account that opens the other side's route goes to its counterpart
 * (`counterparts.ts`, Q1, Q15), and `shell="reader"` (the help pages, Q2) renders the side of the
 * reader. The kind decides only the views; the API decides every access (§14.4). The kind also
 * decides the contextual help of the help menu (§2.3) and the tours (§2.4), and the desktop side
 * navigation starts as this browser left it. An account the API refuses sees only a notice with
 * the sign-out.
 */
export async function AccountShell({
  shell: requestedShell,
  children,
}: {
  shell: Shell | 'reader';
  children: ReactNode;
}) {
  await requireSession();
  const queryClient = getServerQueryClient();
  const client = await getServerApiClient();
  await Promise.all([
    queryClient.prefetchQuery(currentUserQueryOptions(client)),
    queryClient.prefetchQuery(productTourProgressQueryOptions(client)),
  ]);
  const userQueryKey = currentUserQueryOptions(client).queryKey;
  // A valid sign-in whose account the API refuses: deactivated, or the deactivation's Keycloak
  // job has not run yet (§7.4).
  const userError = queryClient.getQueryState(userQueryKey)?.error;
  if (userError instanceof ApiError && userError.status === 401) {
    return <AccountDeactivatedNotice />;
  }
  const user = queryClient.getQueryData(userQueryKey);
  // When the API cannot tell, the requested side is rendered, and the help gives only the pages
  // for end users (§2.3).
  const kind: UserKind = user?.kind ?? 'end_user';
  const shell: Shell =
    user === undefined ? (requestedShell === 'reader' ? 'portal' : requestedShell) : shellOf(kind);
  if (requestedShell !== 'reader' && requestedShell !== shell) {
    redirect(counterpartOf((await headers()).get(REQUEST_PATH_HEADER) ?? '/', shell));
  }
  const navigation: NavigationContext =
    shell === 'team'
      ? { shell, allowedActions: user?.allowedActions ?? [] }
      : { shell, hasProjectChoice: await hasProjectChoice() };
  const helpViews = getHelpViews(kind);
  const messages = pickClientMessages(await getMessages(), 'shell');
  const isNavigationCollapsedOnDesktop = await isNavigationCollapsed();
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NextIntlClientProvider messages={messages}>
        <ProductTourProvider>
          <AppShell
            navigation={navigation}
            isDesktopNavigationCollapsed={isNavigationCollapsedOnDesktop}
            help={
              <LazyHelpMenu views={helpViews}>
                <LazyProductTourMenuItems />
              </LazyHelpMenu>
            }
          >
            {children}
          </AppShell>
        </ProductTourProvider>
      </NextIntlClientProvider>
    </HydrationBoundary>
  );
}

/**
 * Whether the end user has more than one active project to choose from: only then the portal
 * offers **Projects** (§5.7, Q3). The first page of the portal root's list answers it and is
 * hydrated for the root.
 */
async function hasProjectChoice(): Promise<boolean> {
  const queryClient = getServerQueryClient();
  const options = projectsQueryOptions(await getServerApiClient(), 'active');
  await queryClient.prefetchInfiniteQuery(options);
  const firstPage = queryClient.getQueryData(options.queryKey)?.pages[0];
  return firstPage !== undefined && (firstPage.items.length > 1 || firstPage.nextCursor !== null);
}
