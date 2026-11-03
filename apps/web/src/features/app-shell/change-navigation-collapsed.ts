'use server';

import { z } from 'zod';
import { storeNavigationCollapsed } from './navigation-cookie.js';

/**
 * Remembers the desktop choice of the side navigation in this browser (§2.9). Setting a cookie
 * renders the current page again on the server (Next.js); the navigation keeps its own state, so
 * the new value only matters for the next page load.
 */
export async function changeNavigationCollapsed(isCollapsed: boolean): Promise<void> {
  await storeNavigationCollapsed(z.boolean().parse(isCollapsed));
}
