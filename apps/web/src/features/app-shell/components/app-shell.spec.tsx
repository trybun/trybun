import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps } from 'react';
import { prerender } from 'react-dom/static';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/i18n/change-language.js', () => ({ changeLanguage: vi.fn() }));
vi.mock('next/navigation.js', () => ({ usePathname: () => '/' }));
// Outside the App Router of Next.js: a plain link, and no image optimization.
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
vi.mock('next/image', () => ({ default: () => null }));

const { AppShell } = await import('./app-shell.js');

/**
 * The HTML of the shell as the team layout renders it on the server, with the account prefetched
 * into the query cache – after the lazily loaded menus of the header have resolved.
 */
async function renderShell(locale: 'en' | 'pl' = 'en') {
  const queryClient = new QueryClient();
  queryClient.setQueryData(['users', 'me'], {
    id: '0199a3f0-0000-7000-8000-000000000003',
    displayName: 'Dorota Developer',
    email: 'developer@example.com',
    kind: 'team',
  });
  const { prelude } = await prerender(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      <QueryClientProvider client={queryClient}>
        <AppShell help={<button type="button">help-slot</button>}>
          <h1>Page</h1>
        </AppShell>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return new Response(prelude).text();
}

describe('AppShell', () => {
  it('renders the page in the main landmark with a skip link to it', async () => {
    const html = await renderShell();

    expect(html).toContain('<a href="#main"');
    expect(html).toContain('Skip to main content');
    expect(html).toMatch(/<main id="main"[^>]*><h1>Page<\/h1><\/main>/);
  });

  it('marks the current page in both navigations', async () => {
    const html = await renderShell();

    expect(html.match(/aria-label="Main navigation"/g)).toHaveLength(2);
    expect(html.match(/aria-current="page"/g)).toHaveLength(2);
  });

  it('shows the initials of the signed-in account on the account menu', async () => {
    const html = await renderShell();

    expect(html).toMatch(/aria-label="Account menu"[^>]*>.*>DD<\/span>/);
  });

  it('renders the slots of the header actions', async () => {
    expect(await renderShell()).toContain('help-slot');
  });

  it('renders its texts in the language of the user', async () => {
    const html = await renderShell('pl');

    expect(html).toContain('Przejdź do treści');
    expect(html).toContain('aria-label="Menu konta"');
  });
});
