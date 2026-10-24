import { Inject, Injectable } from '@nestjs/common';
import { CATALOGUES, isLocale, type Locale, type Messages } from '@trybun/i18n/catalogues';
import { type Formatters, IntlMessageFormat, type PrimitiveType } from 'intl-messageformat';
import type { TrybunConfig } from '../config/config.schema.js';
import { TRYBUN_CONFIG } from '../config/config.module.js';

/** The full dot-separated keys of the messages, e.g. `emails.footer.automatic`. */
type KeysOf<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${KeysOf<T[K]>}`;
}[keyof T & string];

export type MessageKey = KeysOf<Messages>;

export type MessageValues = Record<string, PrimitiveType>;

/** Formatters that show dates and times in one time zone. */
function formattersIn(timeZone: string): Formatters {
  return {
    getNumberFormat: (locales, options) => new Intl.NumberFormat(locales, options),
    getDateTimeFormat: (locales, options) =>
      new Intl.DateTimeFormat(locales, { ...options, timeZone }),
    getPluralRules: (locales, options) => new Intl.PluralRules(locales, options),
  };
}

/** Compiles an ICU message for a language, with dates and times shown in a time zone. */
export function compileMessage(message: string, locale: Locale, timeZone: string) {
  const format = new IntlMessageFormat(message, locale, undefined, {
    formatters: formattersIn(timeZone),
  });
  // Without tag values, the result is always one string.
  return (values: MessageValues): string => format.format<string>(values) as string;
}

/**
 * The texts of the server – API messages and e-mails – from the ICU message catalogues of
 * `@trybun/i18n` (§13.1, §14.2), in the recipient's language and time zone.
 */
@Injectable()
export class Translator {
  private readonly compiled = new Map<string, (values: MessageValues) => string>();

  constructor(@Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig) {}

  /** The language of a recipient (§13.1): their own, else the system default language. */
  localeOf(language: string | null | undefined): Locale {
    return isLocale(language) ? language : this.config.defaultLanguage;
  }

  /**
   * A message in a language, with dates and times in a time zone: the recipient's, by default
   * the system default time zone (§13.1).
   */
  translate(
    locale: Locale,
    key: MessageKey,
    values: MessageValues = {},
    timeZone: string = this.config.defaultTimeZone,
  ): string {
    const cacheKey = `${locale} ${timeZone} ${key}`;
    let format = this.compiled.get(cacheKey);
    if (format === undefined) {
      const message = key
        .split('.')
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)[part],
          CATALOGUES[locale],
        ) as string;
      format = compileMessage(message, locale, timeZone);
      this.compiled.set(cacheKey, format);
    }
    return format(values);
  }
}
