// @vitest-environment jsdom
// The visibility and the sharing decisions in the team's field panel (S1-11, §5.2, §5.3).
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Ticket } from '@trybun/contracts/tickets';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { problem, ticketResponse } from '../../../../test/factories/ticket.factory.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
// The fields adapt to the width (jsdom has no `matchMedia`): a tablet.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));
// jsdom has no `execCommand`: the editor replaces its placeholders without an undo entry.
Object.defineProperty(document, 'execCommand', { value: () => false });

const { TeamTicketView } = await import('./team-ticket-view.js');

const fake = createFakeApiClient();
api.current = fake.client;

/** Answers the reads of the view with `ticket`. */
function answer(ticket: Ticket) {
  fake.on('GET /api/v1/tickets', { data: { items: [ticket], nextCursor: null } });
  fake.on('GET /api/v1/users/me', {
    data: {
      id: '0199a3f0-0000-7000-8000-000000000031',
      displayName: 'Anna',
      email: 'anna@example.com',
      kind: 'team',
      language: 'en',
      timeZone: null,
      hideTimelineEvents: true,
      allowedActions: [],
    },
  });
  fake.on('GET /api/v1/projects/{projectId}', {
    data: { ...ticket.project, state: 'active', allowedActions: ['read', 'create_ticket'] },
  });
  fake.on('GET /api/v1/tickets/{ticketId}/attachments', { data: { items: [], nextCursor: null } });
}

function renderView() {
  return renderInApp(<TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />);
}

const PENDING = ticketResponse({
  visibility: 'my_organization',
  sharingRequest: 'pending',
  allowedActions: ['read', 'update', 'approve_sharing', 'reject_sharing'],
});

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
});

describe('VisibilityControl', () => {
  it('shares a pending request after the confirmation that reminds to check the content', async () => {
    const user = userEvent.setup();
    answer(PENDING);
    fake.on('POST /api/v1/tickets/{ticketId}/sharing/approve', {
      data: { ...PENDING, visibility: 'all_customers', sharingRequest: 'none', version: 4 },
    });
    renderView();

    expect(await screen.findByText('Sharing requested')).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Share with all customers' }));
    const dialog = await screen.findByRole('dialog', { name: 'Share ERP-12 with all customers?' });
    expect(
      within(dialog).getByText(
        'Check that the description and attachments contain no data identifying the customer.',
      ),
    ).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Share with all customers' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'Shared with all customers',
        type: 'success',
      }),
    );
    expect(fake.callsTo('POST /api/v1/tickets/{ticketId}/sharing/approve')[0]?.init).toMatchObject({
      headers: { 'If-Match': 'W/"3"' },
    });
  });

  it('refuses a request only with a reason', async () => {
    const user = userEvent.setup();
    answer(PENDING);
    fake.on('POST /api/v1/tickets/{ticketId}/sharing/reject', {
      data: {
        ...PENDING,
        sharingRequest: 'rejected',
        sharingRefusalReason: 'Names a customer.',
        version: 4,
      },
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Refuse' }));
    const dialog = await screen.findByRole('dialog', { name: 'Refuse to share ERP-12?' });
    await user.click(within(dialog).getByRole('button', { name: 'Refuse' }));
    expect(await within(dialog).findByText('Enter a reason.')).toBeDefined();
    await user.type(
      await within(dialog).findByRole('textbox', { name: 'Reason' }, { timeout: 5_000 }),
      'Names a customer.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Refuse' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({ title: 'Sharing refused', type: 'success' }),
    );
    expect(fake.callsTo('POST /api/v1/tickets/{ticketId}/sharing/reject')[0]?.init).toMatchObject({
      body: { reason: 'Names a customer.' },
    });
  });

  it('shows a colleague’s earlier decision in the dialog', async () => {
    const user = userEvent.setup();
    answer(PENDING);
    fake.on('POST /api/v1/tickets/{ticketId}/sharing/approve', {
      status: 409,
      error: problem(409, 'ticket.sharing_not_pending'),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Share with all customers' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Share with all customers' }));

    expect(
      await within(dialog).findByText('This sharing request has already been decided.'),
    ).toBeDefined();
  });

  it('narrows a shared ticket on selection, and asks before sharing one', async () => {
    const user = userEvent.setup();
    const shared = ticketResponse({
      visibility: 'my_organization',
      allowedActions: ['read', 'set_visibility_only_me', 'set_visibility_all_customers'],
    });
    answer(shared);
    fake.on('PUT /api/v1/tickets/{ticketId}/visibility', {
      data: { ...shared, visibility: 'only_me', version: 4 },
    });
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Visibility' }));
    await user.click(await screen.findByRole('option', { name: 'All customers' }));
    expect(
      await screen.findByRole('dialog', { name: 'Share ERP-12 with all customers?' }),
    ).toBeDefined();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(fake.callsTo('PUT /api/v1/tickets/{ticketId}/visibility')).toHaveLength(0);

    await user.click(screen.getByRole('combobox', { name: 'Visibility' }));
    await user.click(await screen.findByRole('option', { name: 'Only me' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'Visibility changed: Only me',
        type: 'success',
      }),
    );
    expect(fake.callsTo('PUT /api/v1/tickets/{ticketId}/visibility')[0]?.init).toMatchObject({
      body: { visibility: 'only_me' },
    });
  });

  it('shows the refusal and its reason to the team', async () => {
    answer(
      ticketResponse({
        visibility: 'my_organization',
        sharingRequest: 'rejected',
        sharingRefusalReason: 'Names a customer.',
      }),
    );
    renderView();

    expect(await screen.findByText('Sharing refused')).toBeDefined();
    expect(screen.getByText('Reason of the refusal: Names a customer.')).toBeDefined();
  });

  it('leaves the visibility out for a ticket of the team (Q6)', async () => {
    answer(ticketResponse({ source: 'developer' }));
    renderView();

    expect(await screen.findByText('Details')).toBeDefined();
    expect(screen.queryByText('Visibility')).toBeNull();
  });
});
