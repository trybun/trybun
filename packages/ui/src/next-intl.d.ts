import type { Locale, Messages } from '@trybun/i18n/catalogues';

// Typed keys (§13.1) in this package: a key missing from the `ui` namespace fails the type check.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
