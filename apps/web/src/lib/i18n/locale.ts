import 'server-only';
import { isLocale, negotiateLocale, type Locale } from '@trybun/i18n/catalogues';
import { cookies, headers } from 'next/headers.js';
import { getEnv } from '../env/env.js';

/** The cookie with the language chosen in the web application; the name used by next-intl. */
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export interface LocaleSources {
  /** The value of the language cookie. */
  cookie: string | undefined;
  /** The `Accept-Language` header of the browser. */
  acceptLanguage: string | null;
}

/**
 * The language of a request (§13.1): the chosen language, else the browser language, else the
 * system default language. The language is never part of the URL.
 */
export function resolveLocale(sources: LocaleSources, defaultLanguage: Locale): Locale {
  if (isLocale(sources.cookie)) {
    return sources.cookie;
  }
  return negotiateLocale(sources.acceptLanguage) ?? defaultLanguage;
}

/** The language of the current request. */
export async function getRequestLocale(): Promise<Locale> {
  // Request-time reads first: a page is never prerendered with the build's environment.
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(
    {
      cookie: cookieStore.get(LOCALE_COOKIE)?.value,
      acceptLanguage: headerList.get('accept-language'),
    },
    getEnv().defaultLanguage,
  );
}
