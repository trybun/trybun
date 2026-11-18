import { CATALOGUES } from '@trybun/i18n/catalogues';
import { catalogueOf } from '@trybun/i18n/pseudo/messages';
import { describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';

vi.mock('server-only', () => ({}));
let cookie: string | undefined;
let acceptLanguage = 'en-XA';
vi.mock('next/headers.js', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) =>
        name === 'NEXT_LOCALE' && cookie !== undefined ? { value: cookie } : undefined,
    }),
  headers: () => Promise.resolve(new Headers({ 'accept-language': acceptLanguage })),
}));
// Vitest resolves the client build of next-intl; on the server, the function returns its argument.
vi.mock('next-intl/server', () => ({ getRequestConfig: <T>(create: T) => create }));
// The environment of the E2E tests: the pseudo-locale switched on, on a loopback address.
for (const [name, value] of Object.entries({
  ...TEST_ENV,
  NEXTAUTH_URL: 'http://localhost:3000',
  TRYBUN_PSEUDO_LOCALE: 'true',
})) {
  vi.stubEnv(name, value);
}

const { default: getRequestConfig } = await import('./request.js');

describe('the request configuration with the pseudo-locale of the tests (§13.1)', () => {
  it('gives the stretched texts but keeps English as the language of every consumer', async () => {
    cookie = undefined;
    acceptLanguage = 'en-XA';

    const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe('en');
    expect(config.messages?.signIn).toEqual(catalogueOf('en-XA').signIn);
    expect(config.messages?.signIn).not.toEqual(CATALOGUES.en.signIn);
  });

  it('takes the pseudo-locale from the language cookie too', async () => {
    cookie = 'en-XA';
    acceptLanguage = 'pl';

    const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe('en');
    expect(config.messages?.app).toEqual(catalogueOf('en-XA').app);
  });

  it('serves a language of the product unchanged', async () => {
    cookie = undefined;
    acceptLanguage = 'pl-PL,pl;q=0.9';

    const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config.locale).toBe('pl');
    expect(config.messages?.signIn).toEqual(CATALOGUES.pl.signIn);
  });
});
