import type { DehydratedState } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../lib/auth/session.js', () => ({ requireSession }));
const user = {
  id: '0199a3f0-0000-7000-8000-000000000003',
  displayName: 'Dorota Developer',
  email: 'developer@example.com',
  kind: 'team',
  allowedActions: [],
};
const progress = [
  {
    tourId: 'first_login',
    tourVersion: 1,
    status: 'completed',
    updatedAt: '2026-11-03T09:15:00.000Z',
  },
];
// The API of the internal network answers the prefetches of the signed-in account and its tours.
const get = vi.fn((path: string) =>
  Promise.resolve({
    data: path === '/api/v1/users/me' ? user : { items: progress, nextCursor: null },
    response: new Response(),
  }),
);
vi.mock('../../lib/api-client/server-api-client.js', () => ({
  getServerApiClient: () => Promise.resolve({ GET: get }),
}));

const { default: TeamLayout } = await import('./layout.js');

type Parent<Child> = ReactElement<{ children: Child }>;

/** The application shell inside the hydration boundary and the product tour provider. */
function shellOf(element: ReactElement) {
  return (element as Parent<Parent<ReactElement<{ help: ReactElement }>>>).props.children.props
    .children;
}

describe('TeamLayout', () => {
  it('prefetches the signed-in account and its tour progress and passes them to the browser', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });

    const element = await TeamLayout({ children: <h1>Page</h1> });

    expect(requireSession).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('/api/v1/users/me', expect.anything());
    expect(get).toHaveBeenCalledWith('/api/v1/users/me/product-tours', expect.anything());
    const { queries } = (element.props as { state: DehydratedState }).state;
    expect(queries).toMatchObject([
      { queryKey: ['users', 'me'], state: { data: user } },
      { queryKey: ['product-tours', 'progress'], state: { data: progress } },
    ]);
  });

  it('gives the help menu the help pages of the account kind', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });

    const element = await TeamLayout({ children: <h1>Page</h1> });

    const shell = shellOf(element);
    expect(shell.props.help.props).toMatchObject({
      views: { '/': 'team/tutorials/getting-started' },
    });
  });

  it('gives only the end-user help pages when the account cannot be read', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    get.mockRejectedValue(new Error('The API is unavailable'));

    const element = await TeamLayout({ children: <h1>Page</h1> });

    const shell = shellOf(element);
    expect(shell.props.help.props).toMatchObject({
      views: { '/': 'end-user/tutorials/getting-started' },
    });
  });
});
