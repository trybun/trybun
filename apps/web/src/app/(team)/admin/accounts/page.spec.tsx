import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import { MAX_PAGE_LIMIT } from '@trybun/contracts/pagination';
import type { User } from '@trybun/contracts/users';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createFormatter, createTranslator, NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { prerender } from 'react-dom/static';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../../../lib/auth/session.js', () => ({ requireSession, getAccessToken: vi.fn() }));
const GET = vi.fn();
vi.mock('../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'users.accounts') =>
    Promise.resolve(createTranslator({ locale: 'en', messages: CATALOGUES.en, namespace })),
  getFormatter: () => Promise.resolve(createFormatter({ locale: 'en', timeZone: 'UTC' })),
  getNow: () => Promise.resolve(new Date('2026-11-18T12:00:00.000Z')),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({
  notFound,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const { default: AccountsPage } = await import('./page.js');

const INVITED_ID = '0199a3f0-0000-7000-8000-000000000021';

function account(overrides: Partial<User> = {}): User {
  return {
    id: INVITED_ID,
    displayName: null,
    email: 'invited@customer.example.com',
    kind: 'end_user',
    state: 'invited',
    isAdmin: false,
    githubLogin: null,
    createdAt: '2026-10-29T09:00:00.000Z',
    pendingInvitationCount: 1,
    allowedActions: [],
    ...overrides,
  };
}

const invitation: Invitation = {
  id: '0199a3f0-0000-7000-8000-000000000030',
  user: { id: INVITED_ID, email: 'invited@customer.example.com', displayName: null },
  target: {
    type: 'project',
    project: { id: '0199a3f0-0000-7000-8000-000000000010', key: 'CP', name: 'Customer portal' },
    role: 'end_user',
    organization: null,
  },
  invitedBy: { id: '0199a3f0-0000-7000-8000-000000000001', displayName: 'Ada Admin' },
  state: 'pending',
  expiresAt: '2026-11-05T09:00:00.000Z',
  createdAt: '2026-10-29T09:00:00.000Z',
  allowedActions: ['resend', 'revoke'],
};

/** The accounts the API lists: none unless a test says otherwise. */
let accounts: User[] = [];

function respond(path: string, userActions: string[]) {
  const data =
    path === '/api/v1/users/me'
      ? { allowedActions: userActions }
      : path === '/api/v1/users'
        ? { items: accounts, nextCursor: null }
        : { items: [invitation], nextCursor: null };
  return Promise.resolve({ data, error: undefined, response: new Response(null) });
}

/**
 * The server HTML of the page as the browser first paints it: the client components read the
 * queries the page prefetched, through its `HydrationBoundary` (§18.5, §18.7).
 */
async function render(element: ReactElement): Promise<string> {
  const { prelude } = await prerender(
    <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
      <QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return new Response(prelude).text();
}

describe('AccountsPage', () => {
  beforeEach(() => {
    accounts = [];
    GET.mockClear();
    notFound.mockClear();
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    GET.mockImplementation((path: string) => respond(path, ['open_administration']));
  });

  it.each([
    [{}, {}],
    [
      { kind: 'team', state: 'deactivated' },
      { kind: 'team', state: 'deactivated' },
    ],
    [{ kind: 'robot', state: 'gone' }, {}],
  ])('prefetches the accounts of the filters %j', async (searchParams, query) => {
    await AccountsPage({ searchParams: Promise.resolve(searchParams) });

    expect(requireSession).toHaveBeenCalledWith();
    expect(GET).toHaveBeenCalledWith('/api/v1/users', {
      params: { query },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('renders the pending invitations of the first page on the server (#310)', async () => {
    accounts = [
      account(),
      account({ id: 'none', email: 'other@customer.example.com', pendingInvitationCount: 0 }),
      // Deactivating revokes the invitations, whatever the count says.
      account({ id: 'gone', state: 'deactivated', pendingInvitationCount: 1 }),
    ];

    const html = await render(
      await AccountsPage({ searchParams: Promise.resolve({ state: 'invited' }) }),
    );

    // One read for the whole page of accounts, keyed by all of them (#357).
    expect(GET).toHaveBeenCalledWith('/api/v1/invitations', {
      params: { query: { userId: [INVITED_ID, 'none', 'gone'], limit: MAX_PAGE_LIMIT } },
      signal: expect.anything() as AbortSignal,
    });
    expect(GET.mock.calls.filter(([path]) => path === '/api/v1/invitations')).toHaveLength(1);
    // In the server HTML, so the list does not push the rows below it down after the first paint.
    expect(html).toContain('aria-label="Pending invitations of invited@customer.example.com"');
    expect(html).toContain('Project Customer portal, End user');
  });

  it('still renders the accounts when their invitations cannot be read', async () => {
    accounts = [account()];
    GET.mockImplementation((path: string) =>
      path === '/api/v1/invitations'
        ? Promise.resolve({
            error: { type: 'about:blank', title: 'Too Many Requests', status: 429 },
            response: new Response(null, { status: 429 }),
          })
        : respond(path, ['open_administration']),
    );

    const html = await render(await AccountsPage({ searchParams: Promise.resolve({}) }));

    // A failed prefetch is not passed to the browser, which reads the invitations itself.
    expect(html).toContain('invited@customer.example.com');
    expect(html).not.toContain('Pending invitations of');
  });

  it('tells an Administrator over the rate limit when to try again, not that the page is gone (#356)', async () => {
    GET.mockImplementation((path: string) =>
      path === '/api/v1/users/me'
        ? Promise.resolve({
            error: {
              type: 'about:blank',
              title: 'Too Many Requests',
              status: 429,
              code: 'request.rate_limited',
            },
            response: new Response(null, { status: 429, headers: { 'Retry-After': '45' } }),
          })
        : respond(path, ['open_administration']),
    );

    const html = await render(await AccountsPage({ searchParams: Promise.resolve({}) }));

    expect(notFound).not.toHaveBeenCalled();
    expect(html).toContain('<h2 class="text-xl font-bold">Too many requests</h2>');
    expect(html).toContain('Reload the page in 45 seconds.');
    expect(GET).not.toHaveBeenCalledWith('/api/v1/users', expect.anything());
  });

  it('shows the not-found page to a person who is not the Administrator', async () => {
    GET.mockImplementation((path: string) => respond(path, ['create_project']));

    await expect(AccountsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(GET).not.toHaveBeenCalledWith('/api/v1/users', expect.anything());
  });
});
