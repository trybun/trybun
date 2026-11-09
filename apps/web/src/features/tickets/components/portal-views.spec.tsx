// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { EndUserTicket } from '@trybun/contracts/tickets';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { attachmentResponse } from '../../../../test/factories/attachment.factory.js';
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

const IMAGE_ID = '0199a3f0-0000-7000-8000-0000000000a1';
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
    visibility: 'only_me',
    sharingRequest: 'none',
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
    fake.on('GET /api/v1/tickets/{ticketId}/attachments', {
      data: { items: [], nextCursor: null },
    });
  }

  it('shows the attachments, the images of the description and the file events (S1-08)', async () => {
    const value = ticket({
      description: `Look:\n\n![screenshot.png](/api/v1/attachments/${IMAGE_ID}/content)`,
    });
    answerTicket(value);
    const image = attachmentResponse({
      id: IMAGE_ID,
      fileName: 'screenshot.png',
      contentType: 'image/png',
      isImage: true,
      status: 'available',
      ticketId: value.id,
      allowedActions: ['read', 'delete'],
    });
    fake.on('GET /api/v1/tickets/{ticketId}/attachments', {
      data: { items: [image], nextCursor: null },
    });
    fake.on('GET /api/v1/attachments', { data: { items: [image], nextCursor: null } });
    const anna = { id: '0199a3f0-0000-7000-8000-000000000042', displayName: 'Anna' };
    fake.on('GET /api/v1/tickets/{ticketId}/activity-events', {
      data: {
        items: [
          {
            id: '0199a3f0-0000-7000-8000-000000000043',
            type: 'attachment_added',
            data: { from: null, to: { id: IMAGE_ID, displayName: 'screenshot.png' } },
            actor: anna,
            automaticSource: null,
            createdAt: '2026-11-02T12:00:00.000Z',
          },
          {
            id: '0199a3f0-0000-7000-8000-000000000044',
            type: 'attachment_deleted',
            data: { from: { id: IMAGE_ID, displayName: 'log.txt' }, to: null },
            actor: anna,
            automaticSource: null,
            createdAt: '2026-11-02T13:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    });
    renderInApp(<TicketView identifier="CP-7" />);

    const attachments = await screen.findByRole('region', { name: 'Attachments' });
    expect(
      within(attachments).getByRole('link', { name: 'screenshot.png (opens in a new tab)' }),
    ).toBeDefined();
    expect(
      within(attachments).getByRole('button', { name: 'Delete screenshot.png' }),
    ).toBeDefined();
    // The description shows the available image of the ticket inline (§13.3).
    const description = screen.getByRole('region', { name: 'Description' });
    expect(
      (await within(description).findByRole('img', { name: 'screenshot.png' })).getAttribute('src'),
    ).toBe(`/api/v1/attachments/${IMAGE_ID}/content`);
    expect(fake.callsTo('GET /api/v1/attachments')[0]?.init).toMatchObject({
      params: { query: { id: [IMAGE_ID] } },
    });
    expect(await screen.findByText('Anna added the file screenshot.png')).toBeDefined();
    expect(screen.getByText('Anna deleted the file log.txt')).toBeDefined();
  });

  it('shows the public status with its description and the public timeline (§4.2, §4.5)', async () => {
    answerTicket(ticket());
    renderInApp(<TicketView identifier="CP-7" />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Wrong VAT rate' })).toBeDefined();
    expect(screen.getByText('We are testing the solution')).toBeDefined();
    expect(screen.getByText('Ticket created')).toBeDefined();
    expect(await screen.findByText('Status changed to In progress')).toBeDefined();
    expect(screen.getByText(/Dorota Developer/)).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Is your problem solved?' })).toBeNull();
  });

  // S1-11: the visibility, the state of a sharing request and its withdrawal (§5.2, §5.3).
  it('shows a pending request as All customers and withdraws it', async () => {
    const events = userEvent.setup();
    const pending = ticket({
      visibility: 'my_organization',
      sharingRequest: 'pending',
      allowedActions: [
        'read',
        'update',
        'set_visibility_only_me',
        'set_visibility_my_organization',
      ],
    });
    answerTicket(pending);
    fake.on('PUT /api/v1/tickets/{ticketId}/visibility', {
      data: { ...pending, sharingRequest: 'none', version: 4 },
    });
    renderInApp(<TicketView identifier="CP-7" />);

    expect(await screen.findByText('Visible to: My organization')).toBeDefined();
    expect(
      screen.getByText('Waiting for the team to share this ticket with all customers.'),
    ).toBeDefined();
    expect(screen.getByRole('radio', { name: 'All customers' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    await events.click(screen.getByRole('radio', { name: 'Only me' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'Request to share withdrawn',
        type: 'success',
      }),
    );
    expect(fake.callsTo('PUT /api/v1/tickets/{ticketId}/visibility')[0]?.init).toMatchObject({
      body: { visibility: 'only_me' },
      headers: { 'If-Match': 'W/"3"' },
    });
  });

  it('shows a refusal without a control, and that the organization still sees the ticket', async () => {
    answerTicket(
      ticket({
        visibility: 'my_organization',
        sharingRequest: 'rejected',
        allowedActions: ['read'],
      }),
    );
    renderInApp(<TicketView identifier="CP-7" />);

    expect(
      await screen.findByText(
        'The team did not share this ticket with all customers. Your organization can still see it.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('shows Shared with everyone and a hidden customer as Customer (§5.2, §5.4)', async () => {
    answerTicket(ticket({ visibility: 'all_customers', allowedActions: ['read'] }));
    fake.on('GET /api/v1/tickets/{ticketId}/activity-events', {
      data: {
        items: [
          {
            id: '0199a3f0-0000-7000-8000-000000000042',
            type: 'attachment_added',
            data: { from: null, to: { id: IMAGE_ID, displayName: 'log.txt' } },
            actor: null,
            automaticSource: null,
            createdAt: '2026-11-02T12:00:00.000Z',
          },
          {
            id: '0199a3f0-0000-7000-8000-000000000043',
            type: 'sharing_approved',
            data: null,
            actor: { id: '0199a3f0-0000-7000-8000-000000000041', displayName: 'Dorota Developer' },
            automaticSource: null,
            createdAt: '2026-11-02T13:00:00.000Z',
          },
        ],
        nextCursor: null,
      },
    });
    renderInApp(<TicketView identifier="CP-7" />);

    expect(await screen.findByText('Shared with everyone')).toBeDefined();
    expect(screen.getByText(/^Customer added the file log\.txt/)).toBeDefined();
  });

  it.each([
    ['solved', 'Yes, solved', 'Thank you. The ticket is resolved.'],
    ['not_solved', 'No, still a problem', 'Thank you. The team continues working on the ticket.'],
  ] as const)(
    'thanks for the answer %s although the ticket read again no longer asks (§4.3)',
    async (_answer, button, message) => {
      const events = userEvent.setup();
      answerTicket(
        ticket({
          publicStatus: 'awaiting_reply',
          waitingReason: 'confirmation',
          publicStatusDescription: 'confirmation_needed',
          allowedActions: ['read', 'confirm_resolution'],
        }),
      );
      const get = fake.client.GET.getMockImplementation();
      fake.on('POST /api/v1/tickets/{ticketId}/resolution-confirmation', () => {
        // The ticket read again after the answer no longer offers it, and the panel unmounts
        // when the reading arrives; here it never arrives. The thanks must not wait for it, or
        // TanStack Query skips the toast of the unmounted panel.
        fake.client.GET.mockImplementation(() => new Promise(() => undefined));
        return { data: ticket() };
      });
      renderInApp(<TicketView identifier="CP-7" />);

      try {
        await events.click(await screen.findByRole('button', { name: button }));

        await waitFor(() =>
          expect(toastAdd).toHaveBeenCalledWith({ title: message, type: 'success' }),
        );
      } finally {
        fake.client.GET.mockImplementation(get!);
      }
    },
  );

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
    fake.on('POST /api/v1/tickets/{ticketId}/resolution-confirmation', () => {
      // The team answered first: the ticket read again no longer asks.
      answerTicket(ticket({ publicStatus: 'resolved', publicStatusDescription: 'resolved' }));
      return {
        status: 409,
        error: {
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          code: 'ticket.resolution_confirmation_not_pending',
        },
      };
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
    fake.on('POST /api/v1/tickets/{ticketId}/resolution-confirmation', () => {
      // After the answer the ticket no longer waits for it.
      fake.on('GET /api/v1/tickets', { data: { items: [ticket()], nextCursor: null } });
      return { data: ticket() };
    });
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
    // The ticket read again no longer waits; the page still names the answer just given.
    expect(screen.queryByText('This ticket no longer waits for your confirmation.')).toBeNull();
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
