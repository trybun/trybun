'use server';

import { LOCALES, type Locale } from '@trybun/i18n/catalogues';
import { refresh } from 'next/cache.js';
import { cookies } from 'next/headers.js';
import { z } from 'zod';
import { getEnv } from '../env/env.js';
import { LOCALE_COOKIE } from './locale.js';

const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Switches the language of the web application (§13.1): stores it in the language cookie and
 * renders the current page again, so every text changes without loading another URL.
 */
export async function changeLanguage(locale: Locale): Promise<void> {
  const language = z.enum(LOCALES).parse(locale);
  (await cookies()).set(LOCALE_COOKIE, language, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: getEnv().shouldUseSecureCookies,
  });
  refresh();
}
