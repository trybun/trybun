// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Invitation } from '@trybun/contracts/invitations';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { rateLimitedResult } from '../../../../test/factories/rate-limited.factory.js';

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
/** The generic message of `request.rate_limited`, never shown alone for a refused read (#433). */
const GENERIC = 'Too many requests. Wait a moment and try again.';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));

vi.mock('next/navigation.js', () => ({
  usePathname: () => `/projects/${PROJECT_ID}/settings`,
  useSearchParams: () => new URLSearchParams('tab=members'),
}));

const { ProjectInvitations } = await import('./project-invitations.js');

const fake = createFakeApiClient();
api.current = fake.client;
const INVITATIONS = 'GET /api/v1/invitations';
const QUERY_KEY = ['invitations', 'list', { projectId: PROJECT_ID }];

afterEach(() => {
  cleanup();
  fake.reset();
});

const invitation: Invitation = {
  id: '0199a3f0-0000-7000-8000-000000000020',
  user: {
    id: '0199a3f0-0000-7000-8000-000000000021',
    email: 'ewa@customer.example.com',
    displayName: null,
  },
  target: {
    type: 'project',
    project: { id: PROJECT_ID, key: 'CP', name: 'Customer portal' },
    role: 'end_user',
    organization: null,
  },
  invitedBy: { id: '0199a3f0-0000-7000-8000-000000000011', displayName: 'Anna Nowak' },
  state: 'pending',
  expiresAt: '2026-11-05T09:00:00.000Z',
  createdAt: '2026-10-29T09:00:00.000Z',
  allowedActions: ['resend', 'revoke'],
};

describe('ProjectInvitations', () => {
  it('shows the error of a failed first read under the heading of the section (#437)', async () => {
    fake.on(INVITATIONS, { status: 500, error: {} });
    renderInApp(<ProjectInvitations projectId={PROJECT_ID} />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Something went wrong. Try again later.');
    const section = screen.getByRole('region', { name: 'Pending invitations' });
    expect(section.contains(alert)).toBe(true);
    expect(screen.getByRole('heading', { level: 3, name: 'Pending invitations' })).toBeDefined();
  });

  it('shows the error of a failed refetch of a project without pending invitations', async () => {
    fake.on(INVITATIONS, { data: { items: [], nextCursor: null } });
    const { client } = renderInApp(<ProjectInvitations projectId={PROJECT_ID} />);
    // The first read has answered, so the refetch below does not cancel it into a failed first read.
    await waitFor(() => expect(client.getQueryState(QUERY_KEY)?.status).toBe('success'));

    fake.on(INVITATIONS, { status: 500, error: {} });
    await client.invalidateQueries({ queryKey: ['invitations'] });

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Try again later.',
    );
  });

  it('keeps the loaded invitations when a refetch fails', async () => {
    fake.on(INVITATIONS, { data: { items: [invitation], nextCursor: null } });
    const { client } = renderInApp(<ProjectInvitations projectId={PROJECT_ID} />);
    await screen.findByText('ewa@customer.example.com');

    fake.on(INVITATIONS, { status: 500, error: {} });
    await client.invalidateQueries({ queryKey: ['invitations'] });

    await screen.findByRole('alert');
    expect(screen.getByText('ewa@customer.example.com')).toBeDefined();
  });

  it('shows the wait and Reload page under the heading when the first read is refused (#433)', async () => {
    fake.client.GET.mockImplementationOnce(() => rateLimitedResult());
    renderInApp(<ProjectInvitations projectId={PROJECT_ID} />);

    const alert = await screen.findByRole('alert');
    // `h4` under the `h3` of the section.
    expect(within(alert).getByRole('heading', { level: 4 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(alert.textContent).not.toContain(GENERIC);
    // A document request of the same address, with its tab.
    expect(within(alert).getByRole('link', { name: 'Reload page' }).getAttribute('href')).toBe(
      `/projects/${PROJECT_ID}/settings?tab=members`,
    );
  });

  it('shows the wait above Show more, without Reload page, when a later page is refused (#433)', async () => {
    fake.on(INVITATIONS, { data: { items: [invitation], nextCursor: 'next' } });
    renderInApp(<ProjectInvitations projectId={PROJECT_ID} />);
    await screen.findByText('ewa@customer.example.com');

    fake.client.GET.mockImplementationOnce(() => rateLimitedResult());
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { level: 4 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    // Reload page would drop the invitations loaded; Show more tries the page again (#434).
    expect(within(alert).queryByRole('link')).toBeNull();
    expect(screen.getByText('ewa@customer.example.com')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Show more' })).toBeDefined();
  });
});
