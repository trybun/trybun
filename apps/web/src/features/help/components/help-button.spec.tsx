import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const usePathname = vi.fn<() => string>();
vi.mock('next/navigation.js', () => ({ usePathname }));
// Outside the App Router of Next.js: a plain link.
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));

const { HelpButton } = await import('./help-button.js');

const VIEWS = { '/': 'team/tutorials/getting-started' };

function renderButton(locale: 'en' | 'pl' = 'en') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      <HelpButton views={VIEWS} />
    </NextIntlClientProvider>,
  );
}

describe('HelpButton', () => {
  it('opens the help page mapped to the current view', () => {
    usePathname.mockReturnValue('/');

    expect(renderButton()).toMatch(
      /<a href="\/help\/team\/tutorials\/getting-started" aria-label="Help"/,
    );
  });

  it('opens the help index for a view without a help page', () => {
    usePathname.mockReturnValue('/settings');

    expect(renderButton('pl')).toMatch(/<a href="\/help" aria-label="Pomoc"/);
  });
});
