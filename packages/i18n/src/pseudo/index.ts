import { languageRanges, localeOfRange, type Locale } from '../catalogues/index.js';

/**
 * The pseudo-locale of the tests (§2.9, §13.1): English, accented and stretched
 * (`./pseudo/messages`). `XA` is a private-use region of ISO 3166, the tag Android, Chromium and
 * FormatJS use for this purpose. It is not a language of the product: it is never in `LOCALES` or
 * `CATALOGUES`, never stored in an account and never passed to the API, e-mails or Keycloak.
 */
export const PSEUDO_LOCALE = 'en-XA';

export type PseudoLocale = typeof PSEUDO_LOCALE;

/** The language of a request of the web application: a language of the product or, in tests, the pseudo-locale. */
export type RequestLocale = Locale | PseudoLocale;

export function isPseudoLocale(value: unknown): value is PseudoLocale {
  return value === PSEUDO_LOCALE;
}

/**
 * The language of the product behind a request language, for everything outside the message
 * catalogues – help pages, accounts, Keycloak, templates: English for the pseudo-locale.
 */
export function productLocale(locale: RequestLocale): Locale {
  return isPseudoLocale(locale) ? 'en' : locale;
}

/**
 * `negotiateLocale` of the catalogues with the pseudo-locale (§13.1): when it is enabled, a range
 * that is exactly `en-XA` selects it before its primary subtag would select English. A range of
 * higher quality still wins.
 */
export function negotiateRequestLocale(
  acceptLanguage: string | null | undefined,
  isPseudoLocaleEnabled: boolean,
): RequestLocale | undefined {
  for (const range of languageRanges(acceptLanguage)) {
    if (isPseudoLocaleEnabled && range === PSEUDO_LOCALE.toLowerCase()) {
      return PSEUDO_LOCALE;
    }
    const locale = localeOfRange(range);
    if (locale !== undefined) {
      return locale;
    }
  }
  return undefined;
}
