import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import type { User } from '@trybun/contracts/users';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import { QUERY_CLIENT_CONFIG } from '../../lib/query-client/query-client-config.js';
import { usersQueryOptions } from './queries.js';

const INVITED_ID = '0199a3f0-0000-7000-8000-000000000021';
const LATER_ID = '0199a3f0-0000-7000-8000-000000000022';

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

const invitations = { items: [{ id: 'invitation' }], nextCursor: null };

/** The API: two pages of accounts, the invitations of any account, or a failure for `failing`. */
function api(pages: Record<string, User[]>, failing?: string) {
  const GET = vi.fn((path: string, { params }: { params: { query: Record<string, string> } }) => {
    if (path === '/api/v1/invitations') {
      return Promise.resolve(
        params.query.userId === failing
          ? {
              error: { type: 'about:blank', title: 'Too Many Requests', status: 429 },
              response: new Response(null, { status: 429 }),
            }
          : { data: invitations, response: new Response() },
      );
    }
    const cursor = params.query.cursor ?? 'first';
    return Promise.resolve({
      data: { items: pages[cursor] ?? [], nextCursor: cursor === 'first' ? 'second' : null },
      response: new Response(),
    });
  });
  return { client: { GET } as unknown as ApiClient, GET };
}

const invitationsKey = (userId: string) => ['invitations', 'list', { userId }];

describe('usersQueryOptions', () => {
  it('reads the accounts of the filters page by page', async () => {
    const { client, GET } = api({ first: [] });

    await new QueryClient().fetchInfiniteQuery(
      usersQueryOptions(client, { kind: 'team', state: 'invited', query: 'ada' }),
    );

    expect(GET).toHaveBeenCalledWith('/api/v1/users', {
      params: { query: { kind: 'team', state: 'invited', query: 'ada' } },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('brings the pending invitations of every page, Load more too (#310)', async () => {
    const { client, GET } = api({
      first: [
        account(),
        account({ id: 'none', pendingInvitationCount: 0 }),
        // Deactivating revokes the invitations, whatever the count says.
        account({ id: 'gone', state: 'deactivated' }),
      ],
      second: [account({ id: LATER_ID, email: 'later@customer.example.com' })],
    });
    // The configuration of the application, in which the first page and its invitations stay fresh.
    const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);
    const observer = new InfiniteQueryObserver(queryClient, usersQueryOptions(client, {}));

    await observer.refetch();
    expect(queryClient.getQueryData(invitationsKey(INVITED_ID))).toEqual({
      pages: [invitations],
      pageParams: [null],
    });
    expect(queryClient.getQueryData(invitationsKey(LATER_ID))).toBeUndefined();

    // Load more resolves only with the next page's invitations in the cache, so a row it adds is
    // shown with them and does not grow under the rows after it.
    await observer.fetchNextPage();
    expect(queryClient.getQueryData(invitationsKey(LATER_ID))).toEqual({
      pages: [invitations],
      pageParams: [null],
    });
    expect(
      GET.mock.calls.filter(([path]) => path === '/api/v1/invitations').map(([, init]) => init),
    ).toEqual([
      { params: { query: { userId: INVITED_ID } }, signal: expect.anything() as AbortSignal },
      { params: { query: { userId: LATER_ID } }, signal: expect.anything() as AbortSignal },
    ]);
  });

  it('still returns the page when the invitations of an account cannot be read', async () => {
    const { client } = api({ first: [account()] }, INVITED_ID);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const data = await queryClient.fetchInfiniteQuery(usersQueryOptions(client, {}));

    expect(data.pages[0]?.items.map(({ id }) => id)).toEqual([INVITED_ID]);
    // Not cached: `AccountInvitations` reads it itself.
    expect(queryClient.getQueryData(invitationsKey(INVITED_ID))).toBeUndefined();
  });
});
