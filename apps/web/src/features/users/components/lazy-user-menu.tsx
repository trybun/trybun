'use client';

import { lazy, Suspense } from 'react';

// The menus of the header – and Base UI's Menu with them – load after the first paint: every byte
// requested before it counts towards the simulated LCP of the shell (§2.9, #72). The server
// renders the menu; it becomes interactive once its code has loaded.
const UserMenu = lazy(() =>
  import('./user-menu.js').then((module) => ({ default: module.UserMenu })),
);

/** The user menu of the header, loaded after the first paint. */
export function LazyUserMenu() {
  return (
    <Suspense>
      <UserMenu />
    </Suspense>
  );
}
