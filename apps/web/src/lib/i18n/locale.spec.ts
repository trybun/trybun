import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { resolveLocale } = await import('./locale.js');

describe('resolveLocale', () => {
  it.each([
    // The chosen language wins over the browser language.
    [{ cookie: 'pl', acceptLanguage: 'en-US,en;q=0.9' }, 'en', 'pl'],
    [{ cookie: 'en', acceptLanguage: 'pl' }, 'pl', 'en'],
    // Without a choice: the browser language, if supported.
    [{ cookie: undefined, acceptLanguage: 'pl-PL,pl;q=0.9' }, 'en', 'pl'],
    [{ cookie: 'de', acceptLanguage: 'de-DE,en;q=0.5' }, 'pl', 'en'],
    // Otherwise the system default language.
    [{ cookie: undefined, acceptLanguage: 'de-DE' }, 'pl', 'pl'],
    [{ cookie: undefined, acceptLanguage: null }, 'en', 'en'],
  ] as const)('%j with default %s → %s', (sources, defaultLanguage, expected) => {
    expect(resolveLocale(sources, defaultLanguage)).toBe(expected);
  });

  describe('with the pseudo-locale of the tests', () => {
    it.each([
      [{ cookie: 'en-XA', acceptLanguage: 'pl' }, 'en-XA'],
      [{ cookie: undefined, acceptLanguage: 'en-XA' }, 'en-XA'],
      [{ cookie: undefined, acceptLanguage: 'pl,en-XA;q=0.5' }, 'pl'],
      [{ cookie: 'pl', acceptLanguage: 'en-XA' }, 'pl'],
    ] as const)('enabled: %j → %s', (sources, expected) => {
      expect(resolveLocale(sources, 'en', true)).toBe(expected);
    });

    it.each([
      [{ cookie: 'en-XA', acceptLanguage: 'pl' }, 'pl'],
      [{ cookie: undefined, acceptLanguage: 'en-XA' }, 'en'],
      [{ cookie: 'en-XA', acceptLanguage: null }, 'pl'],
    ] as const)('disabled: %j → %s', (sources, expected) => {
      expect(resolveLocale(sources, 'pl')).toBe(expected);
    });
  });
});
