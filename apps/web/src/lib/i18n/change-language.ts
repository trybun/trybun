'use server';

import type { Locale } from '@trybun/i18n/catalogues';
import { refresh } from 'next/cache.js';
import { storeLanguage } from './language-cookie.js';

/**
 * Switches the language of the web application (§13.1): stores it in the language cookie and
 * renders the current page again, so every text changes without loading another URL.
 */
export async function changeLanguage(locale: Locale): Promise<void> {
  await storeLanguage(locale);
  refresh();
}
