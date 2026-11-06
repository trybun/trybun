// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Attachment } from '@trybun/contracts/attachments';
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
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));

const { TicketAttachments } = await import('./ticket-attachments.js');

const fake = createFakeApiClient();
api.current = fake.client;
const TICKET_ID = '0199a3f0-0000-7000-8000-000000000020';
const OWN_ID = '0199a3f0-0000-7000-8000-0000000000a1';

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
});

function answerAttachments(items: Attachment[]) {
  fake.on('GET /api/v1/tickets/{ticketId}/attachments', { data: { items, nextCursor: null } });
}

const ATTACHMENTS = [
  attachmentResponse({
    id: OWN_ID,
    fileName: 'screenshot.png',
    contentType: 'image/png',
    isImage: true,
    status: 'available',
    ticketId: TICKET_ID,
  }),
  attachmentResponse({
    id: '0199a3f0-0000-7000-8000-0000000000a2',
    fileName: 'export.csv',
    contentType: 'text/csv',
    status: 'quarantine',
    ticketId: TICKET_ID,
    allowedActions: ['read'],
  }),
  attachmentResponse({
    id: '0199a3f0-0000-7000-8000-0000000000a3',
    fileName: 'invoice.pdf',
    contentType: 'application/pdf',
    status: 'infected',
    ticketId: TICKET_ID,
    allowedActions: ['read'],
  }),
];

describe('TicketAttachments', () => {
  it('lists the files with their states and offers Delete only when allowed (§18.5)', async () => {
    answerAttachments(ATTACHMENTS);
    renderInApp(<TicketAttachments ticketId={TICKET_ID} />);

    const section = await screen.findByRole('region', { name: 'Attachments' });
    expect(within(section).getByRole('link', { name: 'screenshot.png' }).getAttribute('href')).toBe(
      `/api/v1/attachments/${OWN_ID}/content`,
    );
    expect(within(section).getByText('Checking…')).toBeDefined();
    expect(within(section).getByText('File removed: malware detected')).toBeDefined();
    expect(within(section).queryByRole('link', { name: 'invoice.pdf' })).toBeNull();
    expect(within(section).getAllByRole('button', { name: /^Delete/ })).toHaveLength(1);
    expect(within(section).getByRole('button', { name: 'Delete screenshot.png' })).toBeDefined();
    expect(fake.callsTo('GET /api/v1/tickets/{ticketId}/attachments')[0]?.init).toMatchObject({
      params: { path: { ticketId: TICKET_ID } },
    });
  });

  it('shows nothing for a ticket without attachments', async () => {
    answerAttachments([]);
    const { container } = renderInApp(<TicketAttachments ticketId={TICKET_ID} />);

    await waitFor(() =>
      expect(fake.callsTo('GET /api/v1/tickets/{ticketId}/attachments')).toHaveLength(1),
    );
    expect(container.innerHTML).toBe('');
  });

  it('deletes a file after the confirmation (Q19)', async () => {
    const events = userEvent.setup();
    answerAttachments(ATTACHMENTS);
    fake.on('DELETE /api/v1/attachments/{attachmentId}', () => {
      answerAttachments(ATTACHMENTS.slice(1));
      return { status: 204 };
    });
    const { client } = renderInApp(<TicketAttachments ticketId={TICKET_ID} />);
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await events.click(await screen.findByRole('button', { name: 'Delete screenshot.png' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete screenshot.png?' });
    expect(fake.callsTo('DELETE /api/v1/attachments/{attachmentId}')).toHaveLength(0);
    await events.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith({
        title: 'File screenshot.png deleted',
        type: 'success',
      }),
    );
    expect(fake.callsTo('DELETE /api/v1/attachments/{attachmentId}')[0]?.init).toMatchObject({
      params: { path: { attachmentId: OWN_ID } },
    });
    // The timeline of the ticket records the deletion.
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['activity-events', 'list', TICKET_ID] });
    await waitFor(() => expect(screen.queryByRole('link', { name: 'screenshot.png' })).toBeNull());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps the file when the confirmation is cancelled', async () => {
    const events = userEvent.setup();
    answerAttachments(ATTACHMENTS);
    renderInApp(<TicketAttachments ticketId={TICKET_ID} />);

    await events.click(await screen.findByRole('button', { name: 'Delete screenshot.png' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete screenshot.png?' });
    await events.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fake.callsTo('DELETE /api/v1/attachments/{attachmentId}')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'screenshot.png' })).toBeDefined();
  });
});
