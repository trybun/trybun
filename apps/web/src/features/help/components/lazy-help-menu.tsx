'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import { HelpMenuButton } from './help-menu-button.js';

// Loaded after the first paint, like the user menu (§2.9, #72); its fallback is its button, so the
// header keeps its place and the tours their target while the page hydrates (#311).
const HelpMenu = lazy(() =>
  import('./help-menu.js').then((module) => ({ default: module.HelpMenu })),
);

/** The help menu of the header, loaded after the first paint. */
export function LazyHelpMenu(props: ComponentProps<typeof HelpMenu>) {
  return (
    <Suspense fallback={<HelpMenuButton />}>
      <HelpMenu {...props} />
    </Suspense>
  );
}
