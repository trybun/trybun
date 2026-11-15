import { InfiniteQueryObserver, QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  DEFAULT_PAGE_LIMIT,
  MAX_PAGE_LIMIT,
  MAX_TICKET_FILTER_VALUES,
} from '@trybun/contracts/pagination';
import type { User } from '@trybun/contracts/users';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import { QUERY_CLIENT_CONFIG } from '../../lib/query-client/query-client-config.js';
import { accountsInvitationsQueryOptions } from '../invitations/queries.js';
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

/** The pending invitations the API answers for a page of accounts: one per given account. */
function invitationsOf(userIds: string[]) {
  return userIds.map((id) => ({ id: `invitation-${id}`, user: { id } }));
}

type Query = Record<string, string | string[] | number | undefined>;

/**
 * The API: pages of accounts by cursor, and the invitations of the given accounts – in pages of
 * `invitationPageSize`, or a failure while `failing` is set.
 */
function api(
  pages: Record<string, User[]>,
  {
    failing = false,
    invitationPageSize = 100,
  }: { failing?: boolean; invitationPageSize?: number } = {},
) {
  const GET = vi.fn((path: string, { params }: { params: { query: Query } }) => {
    if (path === '/api/v1/invitations') {
      if (failing) {
        return Promise.resolve({
          error: { type: 'about:blank', title: 'Too Many Requests', status: 429 },
          response: new Response(null, { status: 429 }),
        });
      }
      const all = invitationsOf([params.query.userId ?? []].flat() as string[]);
      const from = Number(params.query.cursor ?? 0);
      const to = from + invitationPageSize;
      return Promise.resolve({
        data: { items: all.slice(from, to), nextCursor: to < all.length ? String(to) : null },
        response: new Response(),
      });
    }
    const cursor = (params.query.cursor as string | undefined) ?? 'first';
    return Promise.resolve({
      data: { items: pages[cursor] ?? [], nextCursor: cursor === 'first' ? 'second' : null },
      response: new Response(),
    });
  });
  const invitationReads = () =>
    GET.mock.calls.filter(([path]) => path === '/api/v1/invitations').map(([, init]) => init);
  return { client: { GET } as unknown as ApiClient, GET, invitationReads };
}

/** `count` invited accounts, each with one pending invitation, numbered from `from`. */
function invitedAccounts(count: number, from = 0): User[] {
  return Array.from({ length: count }, (_, index) =>
    account({ id: `0199a3f0-0000-7000-8000-${String(from + index).padStart(12, '0')}` }),
  );
}

const invitationsKey = (accounts: User[]) => [
  'invitations',
  'list',
  { userId: accounts.map(({ id }) => id) },
];

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

  it('reads the invitations of 50 invited accounts with one request (#357)', async () => {
    const first = invitedAccounts(50);
    const { client, GET, invitationReads } = api({ first });
    const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);

    await queryClient.fetchInfiniteQuery(usersQueryOptions(client, {}));

    // The accounts and their invitations: 2 requests, whatever the number of invited accounts.
    expect(GET).toHaveBeenCalledTimes(2);
    expect(invitationReads()).toEqual([
      {
        params: { query: { userId: first.map(({ id }) => id), limit: MAX_PAGE_LIMIT } },
        signal: expect.anything() as AbortSignal,
      },
    ]);
    expect(queryClient.getQueryData(invitationsKey(first))).toEqual(
      invitationsOf(first.map(({ id }) => id)),
    );
  });

  it('fits a page of accounts into one invitations request', () => {
    expect(DEFAULT_PAGE_LIMIT).toBeLessThanOrEqual(MAX_TICKET_FILTER_VALUES);
  });

  it('follows the cursor of the invitations beyond one page of them', async () => {
    const first = invitedAccounts(5);
    const { client, invitationReads } = api({ first }, { invitationPageSize: 2 });
    const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);

    await queryClient.fetchInfiniteQuery(usersQueryOptions(client, {}));

    expect(invitationReads().map((init) => init.params.query.cursor)).toEqual([
      undefined,
      '2',
      '4',
    ]);
    expect(queryClient.getQueryData(invitationsKey(first))).toHaveLength(5);
  });

  it('brings the pending invitations of every page, Load more too (#310)', async () => {
    const first = [
      account(),
      account({ id: 'none', pendingInvitationCount: 0 }),
      // Deactivating revokes the invitations, whatever the count says.
      account({ id: 'gone', state: 'deactivated' }),
    ];
    const second = [account({ id: LATER_ID, email: 'later@customer.example.com' })];
    const { client, invitationReads } = api({ first, second });
    // The configuration of the application, in which the first page and its invitations stay fresh.
    const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);
    const observer = new InfiniteQueryObserver(queryClient, usersQueryOptions(client, {}));

    await observer.refetch();
    // Keyed by every account of the page, so revoking the last invitation of one keeps the key.
    expect(queryClient.getQueryData(invitationsKey(first))).toBeDefined();
    expect(queryClient.getQueryData(invitationsKey(second))).toBeUndefined();

    // Load more resolves only with the next page's invitations in the cache, so a row it adds is
    // shown with them and does not grow under the rows after it.
    await observer.fetchNextPage();
    expect(queryClient.getQueryData(invitationsKey(second))).toEqual(invitationsOf([LATER_ID]));
    expect(invitationReads().map((init) => init.params.query.userId)).toEqual([
      [INVITED_ID, 'none', 'gone'],
      [LATER_ID],
    ]);
  });

  it('reads no invitations for a page without invited accounts', async () => {
    const { client, invitationReads } = api({
      first: [
        account({ pendingInvitationCount: 0 }),
        account({ id: 'gone', state: 'deactivated' }),
      ],
    });

    await new QueryClient().fetchInfiniteQuery(usersQueryOptions(client, {}));

    expect(invitationReads()).toEqual([]);
  });

  it('reads the invitations of the page once more after an invitation changed (#357)', async () => {
    const first = invitedAccounts(30);
    const { client, invitationReads } = api({ first });
    const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);
    const accounts = new InfiniteQueryObserver(queryClient, usersQueryOptions(client, {}));
    const unsubscribe = accounts.subscribe(() => {});
    await accounts.refetch();
    // The rows of the page observe its invitations, as `AccountInvitations` does.
    const rows = first.map((user) =>
      new QueryObserver(queryClient, {
        ...accountsInvitationsQueryOptions(client, first),
        select: (items) => items.filter((item) => item.user.id === user.id),
      }).subscribe(() => {}),
    );
    const before = invitationReads().length;

    // What the invitation mutations invalidate (`invalidateInvitations`).
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
      queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
    ]);

    expect(invitationReads().length - before).toBe(1);
    rows.forEach((stop) => stop());
    unsubscribe();
  });

  it('still returns the page when the invitations cannot be read', async () => {
    const { client, invitationReads } = api({ first: [account()] }, { failing: true });
    const queryClient = new QueryClient(QUERY_CLIENT_CONFIG);

    const data = await queryClient.fetchInfiniteQuery(usersQueryOptions(client, {}));

    expect(data.pages[0]?.items.map(({ id }) => id)).toEqual([INVITED_ID]);
    // Tried once, not retried: the rows read it themselves.
    expect(invitationReads()).toHaveLength(1);
    expect(queryClient.getQueryState(invitationsKey([account()]))?.status).toBe('error');
  });
});
