import en from '../../messages/en.json' with { type: 'json' };
import pl from '../../messages/pl.json' with { type: 'json' };

/** The messages of a language: ICU MessageFormat under dot-separated namespaces (§17.1). */
export type Messages = typeof en;

/**
 * The message catalogues by language (§13.1). English is the reference catalogue: every other
 * one has exactly its keys, which the type check and the tests of this package enforce.
 */
export const CATALOGUES = { en, pl } satisfies Record<string, Messages>;

/** A supported language: an ISO 639-1 code. */
export type Locale = keyof typeof CATALOGUES;

export const LOCALES = Object.keys(CATALOGUES) as Locale[];

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && Object.hasOwn(CATALOGUES, value);
}

/**
 * The language ranges of an `Accept-Language` header (RFC 9110), lower case, by quality – the
 * highest first, equal qualities in the order of the header; ranges of quality 0 are left out.
 */
export function languageRanges(acceptLanguage: string | null | undefined): string[] {
  return (
    (acceptLanguage ?? '')
      .split(',')
      .map((part) => {
        const [range = '', ...parameters] = part.trim().toLowerCase().split(';');
        const quality = parameters
          .map((parameter) => /^\s*q=(\S*)\s*$/.exec(parameter)?.[1])
          .find((value) => value !== undefined);
        return { range: range.trim(), quality: quality === undefined ? 1 : Number(quality) };
      })
      .filter(({ range, quality }) => range !== '' && quality > 0)
      // A stable sort keeps the order of the header among equal qualities.
      .sort((a, b) => b.quality - a.quality)
      .map(({ range }) => range)
  );
}

/** The supported language of a language range: its language or primary subtag. */
export function localeOfRange(range: string): Locale | undefined {
  const [language] = range.split('-');
  return isLocale(language) ? language : undefined;
}

/**
 * The supported language preferred by an `Accept-Language` header (RFC 9110): the first range by
 * quality whose language or primary subtag is supported; `undefined` when none is.
 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale | undefined {
  for (const range of languageRanges(acceptLanguage)) {
    const locale = localeOfRange(range);
    if (locale !== undefined) {
      return locale;
    }
  }
  return undefined;
}
