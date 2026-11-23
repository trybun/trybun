// @vitest-environment jsdom
import { cleanup, screen, waitFor } from '@testing-library/react';
import type { Invitation } from '@trybun/contracts/invitations';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));

const { ProjectInvitations } = await import('./project-invitations.js');

const fake = createFakeApiClient();
api.current = fake.client;
const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
const INVITATIONS = 'GET /api/v1/invitations';

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
    await waitFor(() => expect(fake.callsTo(INVITATIONS)).toHaveLength(1));

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

  it('is not shown without pending invitations', async () => {
    fake.on(INVITATIONS, { data: { items: [], nextCursor: null } });
    const { container } = renderInApp(<ProjectInvitations projectId={PROJECT_ID} />);

    await waitFor(() => expect(fake.callsTo(INVITATIONS)).toHaveLength(1));
    expect(container.innerHTML).toBe('');
  });
});
