// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Ticket } from '@trybun/contracts/tickets';
import { Toaster } from '@trybun/ui/components/toast';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { ticketResponse } from '../../../../test/factories/ticket.factory.js';

// The toasts of the ticket view with the real toaster of `@trybun/ui`, unlike `ticket-changes`.
const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push: vi.fn() }) }));
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

function answer(ticket: Ticket) {
  fake.on('GET /api/v1/tickets', { data: { items: [ticket], nextCursor: null } });
  fake.on('GET /api/v1/tickets/{ticketId}', { data: ticket });
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

afterEach(() => {
  cleanup();
  fake.reset();
});

describe('the Undo toast', () => {
  it('closes at once when Undo is pressed and sends one inverse change on a double click', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    fake.on('PATCH /api/v1/tickets/{ticketId}', (init) => {
      const { body } = init as { body: Partial<Ticket> };
      const version = fake.callsTo('PATCH /api/v1/tickets/{ticketId}').length + 3;
      return { data: ticketResponse({ ...body, version }) };
    });
    renderInApp(
      <Toaster>
        <TeamTicketView identifier="ERP-12" attachmentMaxSizeMb={25} />
      </Toaster>,
    );

    await user.click(await screen.findByRole('combobox', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: 'Critical' }));
    const title = await screen.findByText('Priority changed to Critical');
    const toast = title.closest<HTMLElement>('[data-slot="toast"]');
    expect(toast).not.toBeNull();

    await user.dblClick(within(toast!).getByRole('button', { name: 'Undo' }));

    // The toast closes at once: jsdom runs no exit motion, so it stays in its closing state, with
    // its action disabled until it leaves.
    await waitFor(() => expect(toast!.hasAttribute('data-ending-style')).toBe(true));
    expect(within(toast!).getByRole<HTMLButtonElement>('button', { name: 'Undo' }).disabled).toBe(
      true,
    );
    await waitFor(() => expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(2));
    await user.click(within(toast!).getByRole('button', { name: 'Undo' }));
    // The change and one Undo – the presses after the first repeat nothing.
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(2);
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[1]?.init).toMatchObject({
      headers: { 'If-Match': 'W/"4"' },
      body: { priority: 'high' },
    });
  });
});
