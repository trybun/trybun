import type { RequestLocale } from '@trybun/i18n/pseudo';
import type { WebMessages } from './messages.js';

// Typed keys and languages (§13.1): a key missing from the catalogues fails the type check.
declare module 'next-intl' {
  interface AppConfig {
    // The pseudo-locale of the tests too (§13.1): a consumer that passes the language outside the
    // catalogues maps it with `productLocale`.
    Locale: RequestLocale;
    Messages: WebMessages;
  }
}
