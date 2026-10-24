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
});
