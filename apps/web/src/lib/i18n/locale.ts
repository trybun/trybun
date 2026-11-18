import 'server-only';
import { isLocale, type Locale } from '@trybun/i18n/catalogues';
import { isPseudoLocale, negotiateRequestLocale, type RequestLocale } from '@trybun/i18n/pseudo';
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
 * system default language. The language is never part of the URL. Only when the pseudo-locale of
 * the tests is enabled (`TRYBUN_PSEUDO_LOCALE`, `next dev`) can the cookie or the browser select it.
 */
export function resolveLocale(
  sources: LocaleSources,
  defaultLanguage: Locale,
  isPseudoLocaleEnabled = false,
): RequestLocale {
  if (isLocale(sources.cookie) || (isPseudoLocaleEnabled && isPseudoLocale(sources.cookie))) {
    return sources.cookie;
  }
  return negotiateRequestLocale(sources.acceptLanguage, isPseudoLocaleEnabled) ?? defaultLanguage;
}

/** The language of the current request. */
export async function getRequestLocale(): Promise<RequestLocale> {
  // Request-time reads first: a page is never prerendered with the build's environment.
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const env = getEnv();
  return resolveLocale(
    {
      cookie: cookieStore.get(LOCALE_COOKIE)?.value,
      acceptLanguage: headerList.get('accept-language'),
    },
    env.defaultLanguage,
    env.isPseudoLocaleEnabled,
  );
}
