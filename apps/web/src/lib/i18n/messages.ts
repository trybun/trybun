import { CATALOGUES, type Locale, type Messages } from '@trybun/i18n/catalogues';

/** Namespaces only the server uses: e-mails and the Keycloak login theme. */
const SERVER_NAMESPACES = new Set<string>(['emails', 'keycloak'] satisfies (keyof Messages)[]);

/** The messages of the web application. */
export type WebMessages = Omit<Messages, 'emails' | 'keycloak'>;

/** The messages of the web application in a language, without the namespaces of the server. */
export function getWebMessages(locale: Locale): WebMessages {
  return Object.fromEntries(
    Object.entries(CATALOGUES[locale]).filter(([namespace]) => !SERVER_NAMESPACES.has(namespace)),
  ) as WebMessages;
}
