import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));
// Outside the App Router of Next.js: a plain link.
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { HelpMenu } = await import('./help-menu.js');

function renderMenu(locale: 'en' | 'pl' = 'en') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      <HelpMenu views={{ '/': 'team/tutorials/getting-started' }} />
    </NextIntlClientProvider>,
  );
}

// The items of the open menu are checked by the E2E tests (e2e/help.spec.ts).
describe('HelpMenu', () => {
  it.each([
    ['en', 'Help'],
    ['pl', 'Pomoc'],
  ] as const)(
    'opens from a labelled button, the target of the product tours (%s)',
    (locale, label) => {
      expect(renderMenu(locale)).toMatch(
        new RegExp(`<button[^>]*aria-label="${label}"[^>]*data-tour="app-header-help"`),
      );
    },
  );
});
