'use client';

import { type ComponentProps, lazy, Suspense } from 'react';

// Loaded after the first paint, like the user menu (§2.9, #72).
const HelpMenu = lazy(() =>
  import('./help-menu.js').then((module) => ({ default: module.HelpMenu })),
);

/** The help menu of the header, loaded after the first paint. */
export function LazyHelpMenu(props: ComponentProps<typeof HelpMenu>) {
  return (
    <Suspense>
      <HelpMenu {...props} />
    </Suspense>
  );
}
