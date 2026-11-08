import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
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
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));

const { default: AccountsPage } = await import('./page.js');

function respond(path: string, userActions: string[]) {
  const data =
    path === '/api/v1/users/me' ? { allowedActions: userActions } : { items: [], nextCursor: null };
  return Promise.resolve({ data, error: undefined, response: new Response(null) });
}

describe('AccountsPage', () => {
  beforeEach(() => {
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

  it('shows the not-found page to a person who is not the Administrator', async () => {
    GET.mockImplementation((path: string) => respond(path, ['create_project']));

    await expect(AccountsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(GET).not.toHaveBeenCalledWith('/api/v1/users', expect.anything());
  });
});
