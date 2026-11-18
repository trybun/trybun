import type { Messages } from '@trybun/i18n/catalogues';
import type { RequestLocale } from '@trybun/i18n/pseudo';
import { catalogueOf } from '@trybun/i18n/pseudo/messages';

/** The messages of a request language for tests, the pseudo-locale of the tests included (§13.1). */
export function messagesOf(locale: RequestLocale): Messages {
  return catalogueOf(locale);
}
