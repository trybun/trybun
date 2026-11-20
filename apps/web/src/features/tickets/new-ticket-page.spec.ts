import { CATALOGUES, type Locale } from '@trybun/i18n/catalogues';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { rateLimitedResult } from '../../../test/factories/rate-limited.factory.js';

vi.mock('server-only', () => ({}));
let language: Locale | null = null;
let requestLocale: Locale = 'en';
const projectPages: Record<string, { items: object[]; nextCursor: string | null }> = {};
type Get = (path: string, init: { params?: { query?: { cursor?: string } } }) => Promise<unknown>;
const get = vi.fn<Get>((path, init) =>
  Promise.resolve({
    data:
      path === '/api/v1/users/me'
        ? { id: '0199a3f0-0000-7000-8000-000000000031', kind: 'team', language }
        : projectPages[init.params?.query?.cursor ?? 'first'],
    response: new Response(),
  }),
);
vi.mock('../../lib/api-client/server-api-client.js', () => ({
  getServerApiClient: () => Promise.resolve({ GET: get }),
}));
vi.mock('../../lib/query-client/server-query-client.js', async () => {
  const { QueryClient } = await import('@tanstack/react-query');
  return { getServerQueryClient: () => new QueryClient() };
});
vi.mock('next-intl/server', () => ({
  getLocale: () => Promise.resolve(requestLocale),
  getTranslations: ({ locale }: { locale: Locale; namespace: 'tickets.templates' }) =>
    Promise.resolve(
      (type: keyof (typeof CATALOGUES)['en']['tickets']['templates']) =>
        CATALOGUES[locale].tickets.templates[type],
    ),
}));

const { getNewTicketPage } = await import('./new-ticket-page.js');

const project = (id: string, allowedActions: string[]) => ({
  id,
  name: `Project ${id}`,
  allowedActions,
});

beforeEach(() => {
  language = null;
  requestLocale = 'en';
  projectPages.first = { items: [project('a', ['read', 'create_ticket'])], nextCursor: null };
  get.mockClear();
});

describe('getNewTicketPage', () => {
  it('lists the active projects that allow create_ticket, from every page', async () => {
    projectPages.first = {
      items: [project('a', ['read', 'create_ticket', 'assign_tickets']), project('b', ['read'])],
      nextCursor: 'second',
    };
    projectPages.second = { items: [project('c', ['read', 'create_ticket'])], nextCursor: null };

    const { projects } = await getNewTicketPage();

    expect(projects).toEqual([
      { id: 'a', name: 'Project a', allowedActions: ['read', 'create_ticket', 'assign_tickets'] },
      { id: 'c', name: 'Project c', allowedActions: ['read', 'create_ticket'] },
    ]);
    expect(get).toHaveBeenCalledWith('/api/v1/projects', {
      params: { query: { state: 'active', limit: 100 } },
    });
  });

  it('gives the templates in the account language before the request language (Q4)', async () => {
    language = 'pl';

    expect((await getNewTicketPage()).templates).toEqual(CATALOGUES.pl.tickets.templates);
  });

  it('gives the templates in the request language when the account has none', async () => {
    requestLocale = 'pl';

    expect((await getNewTicketPage()).templates).toEqual(CATALOGUES.pl.tickets.templates);
    requestLocale = 'en';
    expect((await getNewTicketPage()).templates).toEqual(CATALOGUES.en.tickets.templates);
  });

  it.each(['/api/v1/projects', '/api/v1/users/me'])(
    'throws the 429 of %s as an ApiError, which the page shows as the rate limit (#382)',
    async (refused) => {
      const answer = get.getMockImplementation()!;
      get.mockImplementation((path, init) =>
        path === refused ? rateLimitedResult() : answer(path, init),
      );

      await expect(getNewTicketPage()).rejects.toMatchObject({
        name: 'ApiError',
        status: 429,
        retryAfterSeconds: 45,
      });
      get.mockImplementation(answer);
    },
  );
});
