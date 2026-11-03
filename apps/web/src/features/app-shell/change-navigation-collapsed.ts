'use server';

import { z } from 'zod';
import { storeNavigationCollapsed } from './navigation-cookie.js';

/**
 * Remembers the desktop choice of the side navigation in this browser (§2.9). The page is not
 * rendered again: the navigation already shows the choice; the next server render reads it.
 */
export async function changeNavigationCollapsed(isCollapsed: boolean): Promise<void> {
  await storeNavigationCollapsed(z.boolean().parse(isCollapsed));
}
