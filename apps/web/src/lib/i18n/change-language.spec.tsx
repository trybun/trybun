import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';

vi.mock('server-only', () => ({}));

/** The cookies of the browser, as the request carries them and the response sets them. */
const browserCookies = new Map<string, { value: string; options: unknown }>();
let acceptLanguage: string | null = 'en-US,en;q=0.9';
vi.mock('next/headers.js', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => browserCookies.get(name),
      set: (name: string, value: string, options: unknown) =>
        browserCookies.set(name, { value, options }),
    }),
  headers: () =>
    Promise.resolve(
      new Headers(acceptLanguage === null ? {} : { 'accept-language': acceptLanguage }),
    ),
}));
// Vitest resolves the client build of next-intl; on the server, the function returns its argument.
vi.mock('next-intl/server', () => ({ getRequestConfig: <T,>(create: T) => create }));
const refresh = vi.fn();
vi.mock('next/cache.js', () => ({ refresh }));
for (const [name, value] of Object.entries(TEST_ENV)) {
  vi.stubEnv(name, value);
}

const { changeLanguage } = await import('./change-language.js');
const { default: getRequestConfig } = await import('./request.js');

/** A component with a text of the catalogues. */
function SignInStatus() {
  const t = useTranslations('signIn');
  return <p role="status">{t('redirecting')}</p>;
}

/** Renders a page of the web application as the current request would. */
async function renderPage(): Promise<string> {
  const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });
  return renderToStaticMarkup(
    <NextIntlClientProvider {...config}>
      <SignInStatus />
    </NextIntlClientProvider>,
  );
}

describe('changeLanguage', () => {
  beforeEach(() => {
    browserCookies.clear();
    refresh.mockClear();
    acceptLanguage = 'en-US,en;q=0.9';
  });

  it('switches every text of the current page without another URL', async () => {
    expect(await renderPage()).toContain('Redirecting to the sign-in…');

    await changeLanguage('pl');

    expect(refresh).toHaveBeenCalledOnce();
    expect(await renderPage()).toContain('Przekierowanie do logowania…');
  });

  it('stores the language in a cookie for a year', async () => {
    await changeLanguage('pl');

    expect(browserCookies.get('NEXT_LOCALE')).toEqual({
      value: 'pl',
      options: {
        path: '/',
        maxAge: 31_536_000,
        sameSite: 'lax',
        httpOnly: true,
        secure: true,
      },
    });
  });

  it('rejects an unsupported language', async () => {
    await expect(changeLanguage('de' as 'en')).rejects.toThrow();
    expect(browserCookies.size).toBe(0);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('shows the browser language before a language is chosen', async () => {
    acceptLanguage = 'pl-PL,pl;q=0.9';

    expect(await renderPage()).toContain('Przekierowanie do logowania…');
  });

  it('formats dates in the system default time zone', async () => {
    const config = await getRequestConfig({ requestLocale: Promise.resolve(undefined) });

    expect(config).toMatchObject({ locale: 'en', timeZone: 'UTC' });
  });
});
