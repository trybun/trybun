import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SignInRedirect } from './sign-in-redirect.js';

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }));

describe('SignInRedirect', () => {
  it.each([
    ['en', 'Redirecting to the sign-in…'],
    ['pl', 'Przekierowanie do logowania…'],
  ] as const)('announces the redirect in %s', (locale, text) => {
    expect(
      renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
          <SignInRedirect callbackUrl="/" />
        </NextIntlClientProvider>,
      ),
    ).toBe(`<p role="status">${text}</p>`);
  });
});
