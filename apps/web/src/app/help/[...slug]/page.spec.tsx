import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../../lib/auth/session.js', () => ({ requireSession }));
const getHelpReaderKind = vi.fn();
vi.mock('../../../features/help/reader.js', () => ({ getHelpReaderKind }));
const getLocale = vi.fn();
vi.mock('next-intl/server', () => ({
  getLocale,
  getTranslations: (namespace: never) =>
    Promise.resolve(createTranslator({ locale: 'en', messages: CATALOGUES.en, namespace })),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { default: HelpTopicPage, generateMetadata } = await import('./page.js');
const { getHelpPage } = await import('../../../features/help/help-content.js');

function render(element: ReactElement, locale: 'en' | 'pl') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      {element}
    </NextIntlClientProvider>,
  );
}

const params = (...slug: string[]) => ({ params: Promise.resolve({ slug }) });

describe('HelpTopicPage', () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
  });

  it.each([
    ['en', 'Getting started for the team', 'All help topics'],
    ['pl', 'Pierwsze kroki dla zespołu', 'Wszystkie tematy pomocy'],
  ] as const)('renders a team page for the team (%s)', async (locale, title, back) => {
    getLocale.mockResolvedValue(locale);
    getHelpReaderKind.mockResolvedValue('team');

    const html = render(
      await HelpTopicPage(params('team', 'tutorials', 'getting-started')),
      locale,
    );

    expect(html).toContain(`<h1 class="text-2xl font-bold">${title}</h1>`);
    expect(html).toContain(back);
    // A relative link to another page leads to its address in the help.
    expect(html).toContain('href="/help/team/explanation/help-for-end-users"');
    expect(requireSession).toHaveBeenCalledWith();
  });

  it('never gives an end user a team page', async () => {
    getLocale.mockResolvedValue('en');
    getHelpReaderKind.mockResolvedValue('end_user');

    await expect(HelpTopicPage(params('team', 'tutorials', 'getting-started'))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  it.each([[['end-user', 'how-to']], [['end-user', 'how-to', 'missing']], [['..', 'x', 'y']]])(
    'does not find %j',
    async (slug) => {
      getLocale.mockResolvedValue('en');
      getHelpReaderKind.mockResolvedValue('team');

      await expect(HelpTopicPage(params(...slug))).rejects.toThrow('NEXT_NOT_FOUND');
    },
  );
});

// The not-found reaches the metadata, so the tab shows the translated not-found title after a
// client-side navigation too (#404).
describe('generateMetadata of a help page', () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    getLocale.mockResolvedValue('en');
  });

  it('names the topic, then the help, in the tab of a page the reader receives', async () => {
    getHelpReaderKind.mockResolvedValue('team');
    const topic = getHelpPage('en', 'team', 'team/tutorials/getting-started')?.title;

    expect(topic).toBeDefined();
    await expect(generateMetadata(params('team', 'tutorials', 'getting-started'))).resolves.toEqual(
      {
        title: { absolute: `${topic} – Help – Trybun` },
      },
    );
  });

  it.each([
    ['a page for the team, for an end user', ['team', 'tutorials', 'getting-started']],
    ['an address that is no help page', ['no-such-topic']],
  ])('is not found for %s', async (_case, slug) => {
    getHelpReaderKind.mockResolvedValue('end_user');

    await expect(generateMetadata(params(...slug))).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
