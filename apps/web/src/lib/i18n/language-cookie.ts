import 'server-only';
import { LOCALES, type Locale } from '@trybun/i18n/catalogues';
import { cookies } from 'next/headers.js';
import { z } from 'zod';
import { getEnv } from '../env/env.js';
import { LOCALE_COOKIE } from './locale.js';

const LOCALE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Stores the language of the web application in the language cookie of the response (§13.1):
 * when it is switched, and at sign-in from the language of the account.
 */
export async function storeLanguage(locale: Locale): Promise<void> {
  const language = z.enum(LOCALES).parse(locale);
  (await cookies()).set(LOCALE_COOKIE, language, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: getEnv().shouldUseSecureCookies,
  });
}
