import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { SetupWizard } = await import('./setup-wizard.js');
const { AdministratorForm } = await import('./administrator-form.js');
const { SetupMessage } = await import('./setup-message.js');

function render(element: ReactElement, locale: 'en' | 'pl' = 'en'): string {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      <QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('SetupWizard', () => {
  it('checks the link on the server, which cannot read the fragment of the address', () => {
    expect(render(<SetupWizard />)).toContain('Checking the setup link…');
  });
});

describe('AdministratorForm', () => {
  const setup = {
    status: 'available',
    defaultLanguage: 'pl',
    defaultTimeZone: 'Europe/Warsaw',
  } as const;

  it.each([
    [
      'en',
      ['First name', 'Last name', 'E-mail address', 'Password', 'Create Administrator account'],
    ],
    ['pl', ['Imię', 'Nazwisko', 'Adres e-mail', 'Hasło', 'Utwórz konto Administratora']],
  ] as const)('labels its fields (%s)', (locale, texts) => {
    const html = render(
      <AdministratorForm token="token" setup={setup} onTokenRejected={vi.fn()} />,
      locale,
    );

    for (const text of texts) {
      expect(html).toContain(text);
    }
  });

  it('prefills the language and time zone with the system defaults it shows', () => {
    const html = render(
      <AdministratorForm token="token" setup={setup} onTokenRejected={vi.fn()} />,
    );

    expect(html).toContain(
      'Default language of the system: Polski; default time zone: Europe/Warsaw.',
    );
    expect(html).toContain('autoComplete="new-password"');
  });
});

describe('SetupMessage', () => {
  it('signs in to the getting-started checklist', () => {
    expect(render(<SetupMessage title="Trybun is already set up" signIn />)).toContain(
      'href="/sign-in?callbackUrl=%2Fadmin"',
    );
  });
});
