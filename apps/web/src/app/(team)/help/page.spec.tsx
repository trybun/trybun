import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../../lib/auth/session.js', () => ({ requireSession }));
const getHelpReaderKind = vi.fn();
vi.mock('../../../features/help/reader.js', () => ({ getHelpReaderKind }));
const getLocale = vi.fn();
vi.mock('next-intl/server', () => ({
  getLocale,
  getTranslations: (namespace: string) => Promise.resolve((key: string) => `${namespace}.${key}`),
}));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { default: HelpPage } = await import('./page.js');

async function renderPage(locale: 'en' | 'pl') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      {await HelpPage()}
    </NextIntlClientProvider>,
  );
}

describe('HelpPage', () => {
  it('lists only the end-user pages for an end user', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    getLocale.mockResolvedValue('pl');
    getHelpReaderKind.mockResolvedValue('end_user');

    const html = await renderPage('pl');

    expect(requireSession).toHaveBeenCalledWith();
    expect(html).toContain('Przeszukaj pomoc');
    expect(html).toContain('href="/help/end-user/how-to/change-language"');
    expect(html).not.toContain('href="/help/team/');
    // One audience: its heading is only for screen readers.
    expect(html).toContain('<h2 id="help-end-user" class="sr-only">Dla użytkowników</h2>');
  });

  it('lists the pages of every audience for the team', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    getLocale.mockResolvedValue('en');
    getHelpReaderKind.mockResolvedValue('team');

    const html = await renderPage('en');

    expect(html).toContain('href="/help/end-user/how-to/change-language"');
    expect(html).toContain('href="/help/team/tutorials/getting-started"');
    expect(html).toContain('>For the team</h2>');
    expect(html).toContain('>How-to guides</h3>');
  });
});
