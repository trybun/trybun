// @vitest-environment jsdom
import { CATALOGUES, type Locale } from '@trybun/i18n/catalogues';
import { screen } from '@testing-library/react';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ComponentType } from 'react';
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getWebMessages, pickClientMessages } from '../lib/i18n/messages.js';

let locale: Locale = 'en';
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'notFoundPage' | 'app') =>
    Promise.resolve(createTranslator({ locale, messages: CATALOGUES[locale], namespace })),
}));
vi.mock('next/image', () => ({ default: (props: ComponentProps<'img'>) => <img {...props} /> }));

const { default: RootNotFound, generateMetadata: rootMetadata } = await import('./not-found.js');
const { default: TeamNotFound, generateMetadata: teamMetadata } =
  await import('./(team)/not-found.js');
const { default: PortalNotFound, generateMetadata: portalMetadata } =
  await import('./(portal)/not-found.js');
const { default: HelpNotFound, generateMetadata: helpMetadata } =
  await import('./help/not-found.js');

/**
 * Renders a not-found page on the server, as Next.js does, under the client messages of the root
 * layout – the only provider above `app/not-found.tsx` – so a text the browser would miss fails
 * the test; the texts of the notice itself come from the request (`getTranslations`).
 */
async function renderNotFoundPage(page: ComponentType) {
  const Page = page;
  const { prelude } = await prerender(
    <NextIntlClientProvider
      locale={locale}
      messages={pickClientMessages(getWebMessages(locale), 'root')}
      timeZone="UTC"
    >
      <Page />
    </NextIntlClientProvider>,
  );
  document.body.innerHTML = await new Response(prelude).text();
}

afterEach(() => {
  locale = 'en';
  document.body.innerHTML = '';
});

// The not-found pages replace the untranslated 404 page of Next.js (#401).
describe.each([
  ['the root', RootNotFound, '/', 'Go to the home page', 'Przejdź na stronę główną'],
  ['the team views', TeamNotFound, '/', 'Go to the home page', 'Przejdź na stronę główną'],
  ['the portal', PortalNotFound, '/portal', 'Go to the home page', 'Przejdź na stronę główną'],
  ['the help', HelpNotFound, '/help', 'All help topics', 'Wszystkie tematy pomocy'],
] as const)('not-found.tsx of %s', (_, page, home, homeEn, homePl) => {
  it.each([
    ['en', 'Page not found', 'This page does not exist or is not available to you.', homeEn],
    [
      'pl',
      'Nie znaleziono strony',
      'Ta strona nie istnieje albo nie masz do niej dostępu.',
      homePl,
    ],
  ] as const)(
    'says so in the language of the person, with the way back to its home (%s)',
    async (language, title, text, link) => {
      locale = language;

      await renderNotFoundPage(page);

      expect(screen.getByRole('heading', { level: 1, name: title })).toBeDefined();
      expect(screen.getByText(text, { exact: false })).toBeDefined();
      expect(screen.getByRole('link', { name: link }).getAttribute('href')).toBe(home);
    },
  );
});

const TAB_TITLES = [
  ['en', 'Page not found – Trybun'],
  ['pl', 'Nie znaleziono strony – Trybun'],
] as const;

// Next.js reads the metadata of a `not-found.tsx` for an unmatched address and for a page whose
// `generateMetadata` calls `notFound()` – on a page load, a client-side navigation and a language
// switch alike, which a `<title>` element of the page would not cover (#404).
describe.each([
  ['the root', RootNotFound, rootMetadata],
  ['the team views', TeamNotFound, teamMetadata],
  ['the portal', PortalNotFound, portalMetadata],
  ['the help', HelpNotFound, helpMetadata],
] as const)('not-found.tsx of %s', (_, page, generateMetadata) => {
  it.each(TAB_TITLES)(
    'translates the title of the browser tab in its metadata, without a second title (%s)',
    async (language, title) => {
      locale = language;

      expect(await generateMetadata()).toEqual({ title: { absolute: title } });
      await renderNotFoundPage(page);
      expect(document.querySelector('title')).toBeNull();
    },
  );
});

describe('not-found.tsx of the root', () => {
  it('is a page of its own with the header of the public pages, as no shell renders around it', async () => {
    await renderNotFoundPage(RootNotFound);

    expect(screen.getByRole('banner').textContent).toContain('Trybun');
    expect(screen.getByRole('main').contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  });
});

describe('not-found.tsx inside the application shell', () => {
  it.each([TeamNotFound, PortalNotFound, HelpNotFound])(
    'adds no header or main area, as the shell around it has them',
    async (page) => {
      await renderNotFoundPage(page);

      expect(screen.queryByRole('banner')).toBeNull();
      expect(screen.queryByRole('main')).toBeNull();
    },
  );
});
