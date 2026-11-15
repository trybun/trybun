'use client';

import { lazy, Suspense } from 'react';
import { UserMenuButton } from './user-menu-button.js';

// The menus of the header – and Base UI's Menu with them – load after the first paint: every byte
// requested before it counts towards the simulated LCP of the shell (§2.9, #72). The server
// renders the menu; it becomes interactive once its code has loaded. The fallback is its button:
// React drops the server HTML of a boundary that receives an update before its code has loaded,
// and without it the button vanished while the page hydrated, moving the header items and losing
// the target of the product tours (#308, #311).
const UserMenu = lazy(() =>
  import('./user-menu.js').then((module) => ({ default: module.UserMenu })),
);

/**
 * The user menu of the header, loaded after the first paint.
 * @param accountName the display name or address of the signed-in account, from the account the
 *   layout prefetched – the menu itself reads it from the query, which needs the API client
 */
export function LazyUserMenu({ accountName }: { accountName: string | undefined }) {
  return (
    <Suspense fallback={<UserMenuButton name={accountName} />}>
      <UserMenu />
    </Suspense>
  );
}
