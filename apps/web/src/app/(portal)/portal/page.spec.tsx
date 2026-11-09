import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../../../lib/auth/session.js', () => ({ requireSession: vi.fn() }));
vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock('next/navigation.js', () => ({ redirect }));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: string) => {
    const [first, second] = namespace.split('.') as ['portal', 'root'];
    const texts = CATALOGUES.en[first][second] as Record<string, string>;
    return Promise.resolve((key: string) => texts[key] ?? key);
  },
}));

const project = (id: string) => ({
  id,
  name: `Project ${id}`,
  key: 'P',
  state: 'active',
  allowedActions: [],
});
let projects: ReturnType<typeof project>[] = [];
let tickets: unknown[] = [];
const get = vi.fn((path: string) =>
  Promise.resolve({
    data:
      path === '/api/v1/projects'
        ? { items: projects, nextCursor: null }
        : { items: tickets, nextCursor: null },
    response: new Response(),
  }),
);
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  browserApiClient: { GET: get },
}));
vi.mock('../../../lib/api-client/server-api-client.js', () => ({
  getServerApiClient: () => Promise.resolve({ GET: get }),
}));
// A new query client per test, as per request.
vi.mock('../../../lib/query-client/server-query-client.js', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { getServerQueryClient: () => new QueryClient() };
});

const { default: PortalRootPage } = await import('./page.js');

function render(element: ReactElement) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
      <QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  get.mockClear();
  redirect.mockClear();
  tickets = [];
});

describe('PortalRootPage', () => {
  it('redirects to the home of the only active project (§5.7)', async () => {
    projects = [project('a')];

    await expect(PortalRootPage()).rejects.toThrow('NEXT_REDIRECT /portal/projects/a');
    expect(get).toHaveBeenCalledWith('/api/v1/projects', {
      params: { query: { state: 'active' } },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('lists several active projects', async () => {
    projects = [project('a'), project('b')];

    const html = render(await PortalRootPage());

    expect(html).toContain('Your projects');
    // The list is hydrated from the prefetched page.
    expect(html).toContain('href="/portal/projects/b"');
    expect(redirect).not.toHaveBeenCalled();
  });

  it.each([
    [[], false],
    [[{ id: 't' }], true],
  ])(
    'without an active project shows the empty state, with My tickets when there are tickets (%j, Q4)',
    async (requested, hasLink) => {
      projects = [];
      tickets = requested;

      const html = render(await PortalRootPage());

      expect(html).toContain('You don&#x27;t have access to any project yet');
      expect(html.includes('href="/portal/tickets"')).toBe(hasLink);
    },
  );
});
