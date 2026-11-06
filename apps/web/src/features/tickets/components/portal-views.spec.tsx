// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { EndUserTicket } from '@trybun/contracts/tickets';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
// `replace` is a prop of the Next.js link only.
vi.mock('next/link', () => ({
  default: (props: ComponentProps<'a'> & { replace?: boolean }) => {
    const anchorProps = { ...props };
    delete anchorProps.replace;
    return <a {...anchorProps} />;
  },
}));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));

const { MyTicketsList } = await import('./my-tickets-list.js');
const { TicketView } = await import('./ticket-view.js');
const { ResolutionConfirmation } = await import('./resolution-confirmation.js');

const fake = createFakeApiClient();
api.current = fake.client;

const PROJECT = { id: '0199a3f0-0000-7000-8000-000000000010', key: 'CP', name: 'Customer portal' };

function ticket(overrides: Partial<EndUserTicket> = {}): EndUserTicket {
  return {
    id: '0199a3f0-0000-7000-8000-000000000020',
    projectId: PROJECT.id,
    project: PROJECT,
    number: 7,
    identifier: 'CP-7',
    title: 'Wrong VAT rate',
    description: 'The invoice shows **23%**.',
    requester: { id: '0199a3f0-0000-7000-8000-000000000030', displayName: 'Celina Customer' },
    version: 3,
    createdAt: '2026-11-02T09:00:00.000Z',
    updatedAt: '2026-11-03T09:00:00.000Z',
    allowedActions: ['read'],
    publicStatus: 'in_progress',
    waitingReason: null,
    duplicateOf: null,
    publicStatusDescription: 'testing',
    ...overrides,
  };
}

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
});

describe('MyTicketsList', () => {
  it('lists the tickets awaiting a reply first, under their own heading, with their projects', async () => {
    fake.on('GET /api/v1/tickets', {
      data: {
        items: [
          ticket({
            id: '0199a3f0-0000-7000-8000-000000000021',
            identifier: 'CP-8',
            title: 'Confirm me',
            publicStatus: 'awaiting_reply',
            publicStatusDescription: 'confirmation_needed',
          }),
          ticket(),
        ],
        nextCursor: null,
      },
    });
    renderInApp(<MyTicketsList />);

    const awaiting = await screen.findByRole('region', { name: 'Awaiting your reply' });
    expect(within(awaiting).getByText('Confirm me')).toBeDefined();
    // The heading and the badge, which carries an icon besides its colour (§13.4).
    expect(within(awaiting).getAllByText('Awaiting your reply')).toHaveLength(2);
    const others = screen.getByRole('region', { name: 'Other tickets' });
    expect(within(others).getByText('Wrong VAT rate')).toBeDefined();
    expect(within(others).getByText(/Customer portal/)).toBeDefined();
    expect(fake.callsTo('GET /api/v1/tickets')[0]?.init).toMatchObject({
      params: { query: { involvement: 'mine' } },
    });
  });

  it('says when the person has no tickets', async () => {
    fake.on('GET /api/v1/tickets', { data: { items: [], nextCursor: null } });
    renderInApp(<MyTicketsList projectId={PROJECT.id} limit={10} />);

    expect(await screen.findByText("You haven't created any tickets yet.")).toBeDefined();
    expect(fake.callsTo('GET /api/v1/tickets')[0]?.init).toMatchObject({
      params: { query: { involvement: 'mine', projectId: PROJECT.id, limit: 10 } },
    });
  });
});

describe('TicketView', () => {
  function answerTicket(value: EndUserTicket) {
    fake.on('GET /api/v1/tickets', { data: { items: [value], nextCursor: null } });
    fake.on('GET /api/v1/projects/{projectId}', {
      data: { ...PROJECT, state: 'active', allowedActions: ['read', 'create_ticket'] },
    });
    fake.on('GET /api/v1/tickets/{ticketId}/activity-events', {
      data: {
        items: [
          {
            id: '0199a3f0-0000-7000-8000-000000000040',
            type: 'status_changed',
            data: { from: 'received', to: 'in_progress' },
            actor: { id: '0199a3f0-0000-7000-8000-000000000041', displayName: 'Dorota Developer' },
            automaticSource: null,
            createdAt: '2026-11-02T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    });
  }

  it('shows the public status with its description and the public timeline (§4.2, §4.5)', async () => {
    answerTicket(ticket());
    renderInApp(<TicketView identifier="CP-7" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Wrong VAT rate' })).toBeDefined();
    expect(screen.getByText('We are testing the solution')).toBeDefined();
    expect(screen.getByText('You created this ticket')).toBeDefined();
    expect(await screen.findByText('Status changed to In progress')).toBeDefined();
    expect(screen.getByText(/Dorota Developer/)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Is your problem solved?' })).toBeNull();
  });

  it('answers the resolution question, and shows a late answer as such (§4.3)', async () => {
    const events = userEvent.setup();
    answerTicket(
      ticket({
        publicStatus: 'awaiting_reply',
        waitingReason: 'confirmation',
        publicStatusDescription: 'confirmation_needed',
        allowedActions: ['read', 'confirm_resolution'],
      }),
    );
    fake.on('POST /api/v1/tickets/{ticketId}/resolution-confirmation', {
      status: 409,
      error: {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'ticket.resolution_confirmation_not_pending',
      },
    });
    renderInApp(<TicketView identifier="CP-7" />);

    await events.click(await screen.findByRole('button', { name: 'Yes, solved' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'This ticket no longer waits for your confirmation.',
        type: 'error',
      }),
    );
    expect(
      fake.callsTo('POST /api/v1/tickets/{ticketId}/resolution-confirmation')[0]?.init,
    ).toMatchObject({ body: { answer: 'solved' } });
  });
});

describe('ResolutionConfirmation', () => {
  it('changes nothing until the answer is pressed (§4.3)', async () => {
    const events = userEvent.setup();
    fake.on('GET /api/v1/tickets', {
      data: {
        items: [
          ticket({
            publicStatus: 'awaiting_reply',
            allowedActions: ['read', 'confirm_resolution'],
          }),
        ],
        nextCursor: null,
      },
    });
    fake.on('POST /api/v1/tickets/{ticketId}/resolution-confirmation', { data: ticket() });
    renderInApp(<ResolutionConfirmation identifier="CP-7" answer="not_solved" />);

    const button = await screen.findByRole('button', { name: 'No, still a problem' });
    expect(screen.getByRole('link', { name: /Yes, solved/ }).getAttribute('href')).toBe(
      '/portal/tickets/CP-7/resolution-confirmation?answer=solved',
    );
    expect(fake.callsTo('POST /api/v1/tickets/{ticketId}/resolution-confirmation')).toHaveLength(0);

    await events.click(button);

    expect(
      await screen.findByText('Thank you. The team continues working on the ticket.'),
    ).toBeDefined();
    expect(fake.callsTo('POST /api/v1/tickets/{ticketId}/resolution-confirmation')).toHaveLength(1);
  });

  it('says when the ticket no longer waits for the answer', async () => {
    fake.on('GET /api/v1/tickets', { data: { items: [ticket()], nextCursor: null } });
    renderInApp(<ResolutionConfirmation identifier="CP-7" answer="solved" />);

    expect(
      await screen.findByText('This ticket no longer waits for your confirmation.'),
    ).toBeDefined();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
