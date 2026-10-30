'use server';

import { refresh } from 'next/cache.js';
import { storeTimeZone } from './time-zone-cookie.js';

/**
 * Applies the time zone saved in the account settings (§13.1): stores it in the time-zone cookie
 * and renders the current page again, so dates and times change at once.
 */
export async function changeTimeZone(timeZone: string | null): Promise<void> {
  await storeTimeZone(timeZone);
  refresh();
}
