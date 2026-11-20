// @vitest-environment jsdom
import type { Locale } from '@trybun/i18n/catalogues';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ComponentType } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type ClientMessagesRoute,
  getWebMessages,
  pickClientMessages,
} from '../lib/i18n/messages.js';
import RootError from './error.js';
import HelpError from './help/error.js';
import PortalError from './(portal)/error.js';
import TeamError from './(team)/error.js';

vi.mock('next/image', () => ({ default: (props: ComponentProps<'img'>) => <img {...props} /> }));

type ErrorPage = ComponentType<{ error: unknown; retry: () => void }>;

/**
 * Renders an error page with the messages of the provider it renders under – the root layout's
 * for `app/error.tsx`, `AccountShell`'s for the others – so a text missing there fails the test.
 */
function renderErrorPage(
  errorPage: ErrorPage,
  provider: ClientMessagesRoute,
  { locale = 'en', retry = vi.fn() }: { locale?: Locale; retry?: () => void } = {},
) {
  const Page = errorPage;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={pickClientMessages(getWebMessages(locale), provider)}
      timeZone="UTC"
    >
      <Page error={new Error('digest only')} retry={retry} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
});

// The error pages replace the untranslated error page of Next.js (#382).
describe.each([
  ['the root', RootError, 'root'],
  ['the team views', TeamError, 'shell'],
  ['the portal', PortalError, 'shell'],
  ['the help', HelpError, 'shell'],
] as const)('error.tsx of %s', (_, errorPage, provider) => {
  it.each([
    ['en', 'Something went wrong', 'Trybun could not show this page.', 'Try again'],
    ['pl', 'Coś poszło nie tak', 'Trybun nie mógł wyświetlić tej strony.', 'Spróbuj ponownie'],
  ] as const)('says so in the language of the person (%s)', (locale, title, text, tryAgain) => {
    renderErrorPage(errorPage, provider, { locale });

    expect(screen.getByRole('heading', { level: 1, name: title })).toBeDefined();
    expect(screen.getByText(text, { exact: false })).toBeDefined();
    expect(screen.getByRole('button', { name: tryAgain })).toBeDefined();
  });

  it('renders the route again on Try again', async () => {
    const events = userEvent.setup();
    const retry = vi.fn();
    renderErrorPage(errorPage, provider, { retry });

    await events.click(screen.getByRole('button', { name: 'Try again' }));

    expect(retry).toHaveBeenCalledOnce();
  });
});

describe('error.tsx of the root', () => {
  it('is a page of its own with the header of the public pages, as it replaces everything below the root layout', () => {
    renderErrorPage(RootError, 'root');

    expect(screen.getByRole('banner').textContent).toContain('Trybun');
    expect(screen.getByRole('main').contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });
});

describe('error.tsx inside the application shell', () => {
  it.each([TeamError, PortalError, HelpError])(
    'adds no header or main area, as the shell around it has them',
    (errorPage) => {
      renderErrorPage(errorPage, 'shell');

      expect(screen.queryByRole('banner')).toBeNull();
      expect(screen.queryByRole('main')).toBeNull();
    },
  );
});
