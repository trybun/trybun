import type { Locale } from '@trybun/i18n/catalogues';
import type { WebMessages } from './messages.js';

// Typed keys and languages (§13.1): a key missing from the catalogues fails the type check.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: WebMessages;
  }
}
