'use client';

import { useSyncExternalStore } from 'react';

/** The tablet breakpoint of the theme (`md`, §2.9): below it, overlays are bottom sheets. */
export const TABLET_MEDIA_QUERY = '(min-width: 48rem)';

/**
 * Whether a CSS media query matches, updated when it changes. On the server and during hydration
 * it is `false`, so components that depend on it render their phone layout first (mobile-first).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
