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
};
// The API of the internal network answers the prefetch of the signed-in account.
const get = vi.fn(() => Promise.resolve({ data: user, response: new Response() }));
vi.mock('../../lib/api-client/server-api-client.js', () => ({
  getServerApiClient: () => Promise.resolve({ GET: get }),
}));

const { default: TeamLayout } = await import('./layout.js');

describe('TeamLayout', () => {
  it('prefetches the signed-in account and passes it to the browser', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });

    const element = await TeamLayout({ children: <h1>Page</h1> });

    expect(requireSession).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledWith('/api/v1/users/me', expect.anything());
    const { queries } = (element.props as { state: DehydratedState }).state;
    expect(queries).toMatchObject([{ queryKey: ['users', 'me'], state: { data: user } }]);
  });

  it('gives the help icon the help pages of the account kind', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });

    const element = await TeamLayout({ children: <h1>Page</h1> });

    const shell = (element.props as { children: ReactElement<{ help: ReactElement }> }).children;
    expect(shell.props.help.props).toMatchObject({
      views: { '/': 'team/tutorials/getting-started' },
    });
  });

  it('gives only the end-user help pages when the account cannot be read', async () => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    get.mockRejectedValue(new Error('The API is unavailable'));

    const element = await TeamLayout({ children: <h1>Page</h1> });

    const shell = (element.props as { children: ReactElement<{ help: ReactElement }> }).children;
    expect(shell.props.help.props).toMatchObject({
      views: { '/': 'end-user/tutorials/getting-started' },
    });
  });
});
