// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { Ticket, TicketStatus, TicketWaitingReason } from '@trybun/contracts/tickets';
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
// The fields adapt to the width (jsdom has no `matchMedia`): a tablet, with selects.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));
// jsdom has no `execCommand`: the editor replaces its placeholders without an undo entry.
Object.defineProperty(document, 'execCommand', { value: () => false });

const { TeamTicketView } = await import('./team-ticket-view.js');
const { hasStatusUndo } = await import('./status-control.js');

const fake = createFakeApiClient();
api.current = fake.client;

const CONFLICT = 'This item was changed by someone else – reload to see the latest version';
const ORIGINAL = ticketResponse({
  id: '0199a3f0-0000-7000-8000-000000000027',
  number: 7,
  identifier: 'ERP-7',
  title: 'Totals are rounded twice',
});

/** Answers the reads of the view with `ticket`; the identifier `ERP-7` finds the original. */
function answer(ticket: Ticket) {
  fake.on('GET /api/v1/tickets', (init) => {
    const { identifier } = (init as { params: { query: { identifier?: string } } }).params.query;
    const items = identifier === 'ERP-12' ? [ticket] : identifier === 'ERP-7' ? [ORIGINAL] : [];
    return { data: { items, nextCursor: null } };
  });
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

/** The arguments of the latest toast. */
function lastToast() {
  return toastAdd.mock.calls.at(-1)?.[0] as {
    title: string;
    type: string;
    actionProps?: { children: string; onClick: () => void };
  };
}

/** The status requests sent so far. */
function statusCalls() {
  return fake.callsTo('PUT /api/v1/tickets/{ticketId}/status');
}

async function chooseStatus(name: string) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('combobox', { name: 'Status' }));
  await user.click(await screen.findByRole('option', { name }));
  return user;
}

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
});

describe('hasStatusUndo', () => {
  const at = (status: TicketStatus, waitingReason: TicketWaitingReason | null = null) => ({
    status,
    waitingReason,
  });

  it.each([
    ['between non-terminal statuses', at('in_progress'), at('todo'), 'todo', true],
    ['from the initial status', at('new'), at('triage'), 'triage', true],
    [
      'into a wait for information',
      at('in_progress'),
      at('waiting_for_requester', 'information'),
      'waiting_for_requester',
      true,
    ],
    [
      'out of a wait for information',
      at('waiting_for_requester', 'information'),
      at('in_progress'),
      'in_progress',
      true,
    ],
    [
      'out of a wait for confirmation',
      at('waiting_for_requester', 'confirmation'),
      at('in_progress'),
      'in_progress',
      false,
    ],
    ['into a terminal status', at('in_verification'), at('done'), 'done', false],
    ['out of a terminal status (a reopen)', at('done'), at('todo'), 'todo', false],
    [
      'a redirected done',
      at('in_verification'),
      at('waiting_for_requester', 'confirmation'),
      'done',
      false,
    ],
  ] as const)('%s: %s', (_case, before, after, requested, expected) => {
    expect(hasStatusUndo(before, after, requested)).toBe(expected);
  });
});

describe('StatusControl', () => {
  it('changes the status with If-Match and Undo sends the previous status back (Q10)', async () => {
    answer(ticketResponse());
    fake.on('PUT /api/v1/tickets/{ticketId}/status', (init) => {
      const { status } = (init as { body: { status: TicketStatus } }).body;
      return { data: ticketResponse({ status, version: statusCalls().length + 3 }) };
    });
    renderView();

    await chooseStatus('In verification');

    await waitFor(() => expect(lastToast()?.title).toBe('Status changed to In verification'));
    expect(statusCalls()[0]?.init).toMatchObject({
      headers: { 'If-Match': 'W/"3"' },
      body: { status: 'in_verification' },
    });
    lastToast().actionProps?.onClick();
    await waitFor(() =>
      expect(statusCalls()[1]?.init).toMatchObject({
        headers: { 'If-Match': 'W/"4"' },
        body: { status: 'in_progress' },
      }),
    );
  });

  it('groups the nine statuses by kind', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Status' }));

    const groups = within(await screen.findByRole('listbox')).getAllByRole('group');
    expect(
      groups.map((group) =>
        within(group)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ),
    ).toEqual([
      ['New'],
      ['Triage', 'To do', 'In progress', 'In verification'],
      ['Waiting for requester'],
      ['Done', 'Rejected', 'Duplicate'],
    ]);
  });

  it('explains a done redirected to the confirmation of the requester, without Undo', async () => {
    answer(ticketResponse({ status: 'in_verification' }));
    fake.on('PUT /api/v1/tickets/{ticketId}/status', {
      data: ticketResponse({
        status: 'waiting_for_requester',
        waitingReason: 'confirmation',
        version: 4,
      }),
    });
    renderView();

    await chooseStatus('Done');

    await waitFor(() =>
      expect(lastToast()).toEqual({
        title:
          'The requester is asked to confirm that the problem is solved. The ticket closes automatically after 7 days.',
        type: 'info',
      }),
    );
    expect(await screen.findByText('Waiting for confirmation')).toBeDefined();
  });

  it('offers no Undo for a move into a terminal status', async () => {
    answer(ticketResponse({ source: 'developer' }));
    fake.on('PUT /api/v1/tickets/{ticketId}/status', {
      data: ticketResponse({ status: 'done', version: 4 }),
    });
    renderView();

    await chooseStatus('Done');

    await waitFor(() =>
      expect(lastToast()).toEqual({ title: 'Status changed to Done', type: 'success' }),
    );
  });

  it('shows the status as text with its waiting reason without change_status', async () => {
    answer(
      ticketResponse({
        status: 'waiting_for_requester',
        waitingReason: 'information',
        allowedActions: ['read'],
      }),
    );
    renderView();

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Waiting for requester')).toBeDefined();
    expect(within(details).getByText('Waiting for information')).toBeDefined();
    expect(screen.queryByRole('combobox', { name: 'Status' })).toBeNull();
  });
});

describe('the reject dialog', () => {
  it('requires a reason, then rejects with it and offers no Undo', async () => {
    answer(ticketResponse());
    fake.on('PUT /api/v1/tickets/{ticketId}/status', {
      data: ticketResponse({ status: 'rejected', rejectionReason: 'Works as designed.' }),
    });
    renderView();

    const user = await chooseStatus('Rejected');
    const dialog = await screen.findByRole('dialog', { name: 'Reject ERP-12' });
    expect(
      within(dialog).getByText('The reason will be published to the requester.'),
    ).toBeDefined();
    await user.click(within(dialog).getByRole('button', { name: 'Reject ticket' }));
    expect(await within(dialog).findByText('Enter the reason for the rejection')).toBeDefined();
    expect(statusCalls()).toHaveLength(0);

    await user.type(
      await within(dialog).findByRole('textbox', { name: 'Reason' }, { timeout: 5_000 }),
      'Works as designed.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Reject ticket' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(statusCalls()[0]?.init).toMatchObject({
      body: { status: 'rejected', rejectionReason: 'Works as designed.' },
    });
    expect(lastToast()).toEqual({ title: 'Status changed to Rejected', type: 'success' });
  });

  it('keeps the typed reason and shows the conflict message after a 412', async () => {
    answer(ticketResponse());
    fake.on('PUT /api/v1/tickets/{ticketId}/status', {
      status: 412,
      error: problem(412, 'request.precondition_failed'),
    });
    renderView();

    const user = await chooseStatus('Rejected');
    const dialog = await screen.findByRole('dialog', { name: 'Reject ERP-12' });
    const reason = await within(dialog).findByRole(
      'textbox',
      { name: 'Reason' },
      { timeout: 5_000 },
    );
    await user.type(reason, 'Works as designed.');
    await user.click(within(dialog).getByRole('button', { name: 'Reject ticket' }));

    expect(await within(dialog).findByRole('alert')).toHaveProperty('textContent', CONFLICT);
    expect(within(dialog).getByRole('textbox', { name: 'Reason' })).toHaveProperty(
      'value',
      'Works as designed.',
    );
  });
});

describe('the duplicate dialog', () => {
  it('resolves the original in the project, shows its title and sends its ID', async () => {
    answer(ticketResponse());
    fake.on('PUT /api/v1/tickets/{ticketId}/status', {
      data: ticketResponse({
        status: 'duplicate',
        duplicateOf: { id: ORIGINAL.id, number: 7, projectKey: 'ERP' },
      }),
    });
    renderView();

    const user = await chooseStatus('Duplicate');
    const dialog = await screen.findByRole('dialog', { name: 'Mark ERP-12 as a duplicate' });
    const confirm = within(dialog).getByRole('button', { name: 'Mark as duplicate' });
    expect(confirm).toHaveProperty('disabled', true);
    await user.type(within(dialog).getByRole('textbox', { name: 'Original ticket' }), '7');

    expect(await within(dialog).findByText('ERP-7 · Totals are rounded twice')).toBeDefined();
    expect(fake.callsTo('GET /api/v1/tickets').at(-1)?.init).toMatchObject({
      params: { query: { projectId: ORIGINAL.projectId, identifier: 'ERP-7' } },
    });
    await user.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(statusCalls()[0]?.init).toMatchObject({
      body: { status: 'duplicate', duplicateOfTicketId: ORIGINAL.id },
    });
    expect(lastToast()).toEqual({ title: 'Status changed to Duplicate', type: 'success' });
  });

  it('says when the project has no ticket with the identifier', async () => {
    answer(ticketResponse());
    renderView();

    const user = await chooseStatus('Duplicate');
    const dialog = await screen.findByRole('dialog', { name: 'Mark ERP-12 as a duplicate' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Original ticket' }), 'erp-99');

    expect(
      await within(dialog).findByText('There is no ticket ERP-99 in this project.'),
    ).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Mark as duplicate' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it.each([
    ['ticket.duplicate_of_self', 'A ticket cannot be a duplicate of itself.'],
    ['ticket.duplicate_other_project', 'The original ticket must be in the same project.'],
  ])('shows %s on the Original ticket field', async (code, message) => {
    answer(ticketResponse());
    fake.on('PUT /api/v1/tickets/{ticketId}/status', {
      status: 422,
      error: {
        ...problem(422, code),
        errors: [{ pointer: '/duplicateOfTicketId', code: 'field.invalid', detail: code }],
      },
    });
    renderView();

    const user = await chooseStatus('Duplicate');
    const dialog = await screen.findByRole('dialog', { name: 'Mark ERP-12 as a duplicate' });
    const field = within(dialog).getByRole('textbox', { name: 'Original ticket' });
    await user.type(field, 'ERP-7');
    await within(dialog).findByText('ERP-7 · Totals are rounded twice');
    await user.click(within(dialog).getByRole('button', { name: 'Mark as duplicate' }));

    expect(await within(dialog).findByText(message)).toBeDefined();
    await waitFor(() => expect(field.getAttribute('aria-invalid')).toBe('true'));
    // The field's error is the only one: none below the form.
    expect(
      within(dialog)
        .getAllByRole('alert')
        .map((alert) => alert.textContent),
    ).toEqual([message]);
  });
});
