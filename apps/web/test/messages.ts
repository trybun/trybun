import { CATALOGUES, type Messages } from '@trybun/i18n/catalogues';
import { isPseudoLocale, type RequestLocale } from '@trybun/i18n/pseudo';
import { pseudoLocalize } from '@trybun/i18n/pseudo/messages';

let pseudoMessages: Messages | undefined;

/** The messages of a request language for tests, the pseudo-locale of the tests included (§13.1). */
export function messagesOf(locale: RequestLocale): Messages {
  if (isPseudoLocale(locale)) {
    pseudoMessages ??= pseudoLocalize(CATALOGUES.en);
    return pseudoMessages;
  }
  return CATALOGUES[locale];
}
