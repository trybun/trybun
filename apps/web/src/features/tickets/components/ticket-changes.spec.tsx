// @vitest-environment jsdom
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
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push }) }));
// The fields adapt to the width (jsdom has no `matchMedia`): a tablet unless a test says otherwise.
const viewport = vi.hoisted(() => ({ isTablet: true }));
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY && viewport.isTablet,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));
// jsdom has no `execCommand`: the editor replaces its placeholders without an undo entry.
Object.defineProperty(document, 'execCommand', { value: () => false });

const { TeamTicketView } = await import('./team-ticket-view.js');

const fake = createFakeApiClient();
api.current = fake.client;

const CONFLICT = 'This item was changed by someone else – reload to see the latest version';

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

/** The arguments of the latest toast. */
function lastToast() {
  return toastAdd.mock.calls.at(-1)?.[0] as {
    title: string;
    type: string;
    actionProps?: { children: string; onClick: () => void };
  };
}

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
  push.mockClear();
  viewport.isTablet = true;
});

describe('type and priority', () => {
  it('saves on selection and Undo sends the inverse change with the returned version (Q10)', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    fake.on('PATCH /api/v1/tickets/{ticketId}', (init) => {
      const { body } = init as { body: Partial<Ticket> };
      const version = fake.callsTo('PATCH /api/v1/tickets/{ticketId}').length + 3;
      return { data: ticketResponse({ ...body, version }) };
    });
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: 'Critical' }));

    await waitFor(() => expect(lastToast()?.title).toBe('Priority changed to Critical'));
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[0]?.init).toMatchObject({
      params: { path: { ticketId: '0199a3f0-0000-7000-8000-000000000020' } },
      headers: { 'If-Match': 'W/"3"' },
      body: { priority: 'critical' },
    });
    expect(lastToast().actionProps?.children).toBe('Undo');

    lastToast().actionProps?.onClick();

    await waitFor(() => expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(2));
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[1]?.init).toMatchObject({
      headers: { 'If-Match': 'W/"4"' },
      body: { priority: 'high' },
    });
  });

  it.each([
    [412, 'request.precondition_failed', CONFLICT],
    [403, 'request.forbidden', 'You are not allowed to do this.'],
  ])(
    'shows the message of an Undo refused with %i and reads the ticket again, without a retry',
    async (status, code, message) => {
      const user = userEvent.setup();
      answer(ticketResponse());
      fake.on('PATCH /api/v1/tickets/{ticketId}', (init) =>
        fake.callsTo('PATCH /api/v1/tickets/{ticketId}').length === 1
          ? { data: ticketResponse({ ...(init as { body: Partial<Ticket> }).body, version: 4 }) }
          : { status, error: problem(status, code) },
      );
      renderView();
      await user.click(await screen.findByRole('combobox', { name: 'Type' }));
      await user.click(await screen.findByRole('option', { name: 'Feature' }));
      await waitFor(() => expect(lastToast()?.title).toBe('Type changed to Feature'));
      const reads = fake.callsTo('GET /api/v1/tickets').length;

      lastToast().actionProps?.onClick();

      await waitFor(() => expect(lastToast()).toEqual({ title: message, type: 'error' }));
      await waitFor(() =>
        expect(fake.callsTo('GET /api/v1/tickets').length).toBeGreaterThan(reads),
      );
      expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(2);
      expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[1]?.init).toMatchObject({
        headers: { 'If-Match': 'W/"4"' },
        body: { type: 'bug' },
      });
    },
  );

  it('offers no Undo after setting a type that was not set, which cannot be unset', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ type: null }));
    fake.on('PATCH /api/v1/tickets/{ticketId}', { data: ticketResponse({ version: 4 }) });
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Type' }));
    await user.click(await screen.findByRole('option', { name: 'Bug' }));

    await waitFor(() =>
      expect(lastToast()).toEqual({ title: 'Type changed to Bug', type: 'success' }),
    );
  });

  it('opens the choices in a bottom sheet on phones (§18.6)', async () => {
    viewport.isTablet = false;
    const user = userEvent.setup();
    answer(ticketResponse());
    fake.on('PATCH /api/v1/tickets/{ticketId}', { data: ticketResponse({ priority: 'low' }) });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Priority: High' }));
    const sheet = await screen.findByRole('dialog', { name: 'Priority' });
    await user.click(within(sheet).getByRole('radio', { name: 'Low' }));

    await waitFor(() =>
      expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[0]?.init).toMatchObject({
        body: { priority: 'low' },
      }),
    );
  });
});

describe('one change at a time', () => {
  /** Whether the control has the `disabled` attribute or state of its primitive. */
  function isDisabled(control: HTMLElement) {
    return control.hasAttribute('disabled') || control.hasAttribute('data-disabled');
  }

  it('holds every field while a change of the ticket is pending, so the next one has its version (412)', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    let respond: (() => void) | undefined;
    fake.client.PATCH.mockImplementationOnce((path: string, init?: unknown) => {
      fake.calls.push({ method: 'PATCH', path, init });
      return new Promise((resolve) => {
        respond = () =>
          resolve({
            data: ticketResponse({ priority: 'critical', version: 4 }),
            response: new Response(null, { status: 200 }),
          });
      });
    });
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: 'Critical' }));

    const fields = () =>
      ['Status', 'Assignee', 'Type', 'Priority'].map((name) =>
        screen.getByRole('combobox', { name }),
      );
    await waitFor(() => expect(fields().map(isDisabled)).toEqual([true, true, true, true]));

    respond?.();

    await waitFor(() => expect(fields().map(isDisabled)).toEqual([false, false, false, false]));
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(1);
  });
});

describe('title and description', () => {
  it('saves the title with Enter and cancels it with Escape', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    fake.on('PATCH /api/v1/tickets/{ticketId}', {
      data: ticketResponse({ title: 'Totals of invoices are wrong', version: 4 }),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Edit title' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Title' })).toBeNull();
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Edit title' }));
    const title = screen.getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Totals of invoices are wrong{Enter}');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Totals of invoices are wrong' }),
    ).toBeDefined();
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[0]?.init).toMatchObject({
      headers: { 'If-Match': 'W/"3"' },
      body: { title: 'Totals of invoices are wrong' },
    });
  });

  it('keeps the typed description and shows the conflict message after a 412 (§17.2)', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    fake.on('PATCH /api/v1/tickets/{ticketId}', {
      status: 412,
      error: problem(412, 'request.precondition_failed'),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Edit description' }));
    const editor = await screen.findByRole('textbox', { name: 'Description' }, { timeout: 5_000 });
    await user.clear(editor);
    await user.type(editor, 'The total shows 22%.');
    const reads = fake.callsTo('GET /api/v1/tickets').length;
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveProperty('textContent', CONFLICT);
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveProperty(
      'value',
      'The total shows 22%.',
    );
    await waitFor(() => expect(fake.callsTo('GET /api/v1/tickets').length).toBeGreaterThan(reads));
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveProperty(
      'value',
      'The total shows 22%.',
    );
  });

  it('asks before Cancel discards a typed description (Q10)', async () => {
    const user = userEvent.setup();
    answer(ticketResponse());
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Edit description' }));
    const editor = await screen.findByRole('textbox', { name: 'Description' }, { timeout: 5_000 });
    await user.type(editor, ' More.');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveProperty(
      'value',
      'The total shows **23%**. More.',
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Description' })).toBeNull());
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(0);
  });
});

describe('read-only fields', () => {
  it('renders a control without its action as text, e.g. in an archived project (S1-04)', async () => {
    answer(ticketResponse({ allowedActions: ['read'] }));
    renderView();

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Bug')).toBeDefined();
    expect(within(details).getByText('High')).toBeDefined();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit title' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit description' })).toBeNull();
  });
});

describe('assignee', () => {
  const ANNA = { id: '0199a3f0-0000-7000-8000-000000000031', displayName: 'Anna' };
  const JAN = { id: '0199a3f0-0000-7000-8000-000000000032', displayName: 'Jan' };

  /** The assignable members of the project: the API decides who they are (Q9). */
  function members(...people: { id: string; displayName: string }[]) {
    fake.on('GET /api/v1/projects/{projectId}/members', {
      data: {
        items: people.map((user) => ({
          user: { ...user, githubLogin: null },
          role: 'developer',
          createdAt: '2026-11-01T09:00:00.000Z',
        })),
        nextCursor: null,
      },
    });
  }

  it('offers Assign to me first and Unassigned last, and Undo assigns the previous person', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ assignee: null }));
    members(ANNA, JAN);
    fake.on('PATCH /api/v1/tickets/{ticketId}', (init) => {
      const { assigneeId } = (init as { body: { assigneeId: string | null } }).body;
      return { data: ticketResponse({ assignee: assigneeId === JAN.id ? JAN : null, version: 4 }) };
    });
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
    const list = await screen.findByRole('listbox', { name: 'People' });
    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Assign to me', 'Jan', 'Unassigned']),
    );
    expect(fake.callsTo('GET /api/v1/projects/{projectId}/members')[0]?.init).toMatchObject({
      params: { query: { assignable: 'true' } },
    });
    await user.click(within(list).getByRole('option', { name: 'Jan' }));

    await waitFor(() => expect(lastToast()?.title).toBe('Assigned to Jan'));
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[0]?.init).toMatchObject({
      body: { assigneeId: JAN.id },
    });
    lastToast().actionProps?.onClick();
    await waitFor(() =>
      expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[1]?.init).toMatchObject({
        headers: { 'If-Match': 'W/"4"' },
        body: { assigneeId: null },
      }),
    );
  });

  it('offers no Assign to me to a person who cannot be assigned in the project', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ assignee: null }));
    members(JAN);
    renderView();

    await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
    const list = await screen.findByRole('listbox', { name: 'People' });

    await waitFor(() =>
      expect(
        within(list)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['Jan', 'Unassigned']),
    );
  });

  it('searches the people on the server as the person types (Q9)', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ assignee: null }));
    members(JAN);
    renderView();

    const input = await screen.findByRole('combobox', { name: 'Assignee' });
    // The longest search the server accepts (`MEMBER_CANDIDATE_QUERY_MAX_LENGTH`).
    expect(input.getAttribute('maxlength')).toBe('100');
    await user.clear(input);
    await user.type(input, 'ja');

    await waitFor(() =>
      expect(fake.callsTo('GET /api/v1/projects/{projectId}/members').at(-1)?.init).toMatchObject({
        params: { query: { assignable: 'true', query: 'ja' } },
      }),
    );
  });

  it('shows the message of an Undo refused with 422 and reads the ticket again, without a retry', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ assignee: JAN }));
    members(ANNA, JAN);
    fake.on('PATCH /api/v1/tickets/{ticketId}', () =>
      fake.callsTo('PATCH /api/v1/tickets/{ticketId}').length === 1
        ? { data: ticketResponse({ assignee: null, version: 4 }) }
        : { status: 422, error: problem(422, 'ticket.assignee_not_eligible') },
    );
    renderView();
    await user.click(await screen.findByRole('combobox', { name: 'Assignee' }));
    await user.click(await screen.findByRole('option', { name: 'Unassigned' }));
    await waitFor(() => expect(lastToast()?.title).toBe('Assignee removed'));
    const reads = fake.callsTo('GET /api/v1/tickets').length;

    lastToast().actionProps?.onClick();

    await waitFor(() =>
      expect(lastToast()).toEqual({
        title: 'Only active team members of the project can be assigned.',
        type: 'error',
      }),
    );
    await waitFor(() => expect(fake.callsTo('GET /api/v1/tickets').length).toBeGreaterThan(reads));
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')).toHaveLength(2);
  });

  it('gives a Developer only Assign to me, whose take-over has no Undo (Q10)', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ assignee: JAN, allowedActions: ['read', 'update', 'assign_self'] }));
    fake.on('PATCH /api/v1/tickets/{ticketId}', {
      data: ticketResponse({ assignee: ANNA, allowedActions: ['read', 'update', 'assign_self'] }),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Assign to me' }));

    await waitFor(() => expect(lastToast()).toEqual({ title: 'Assigned to you', type: 'success' }));
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[0]?.init).toMatchObject({
      body: { assigneeId: ANNA.id },
    });
    expect(await screen.findByRole('button', { name: 'Unassign me' })).toBeDefined();
  });

  it('lets a Developer unassign themselves with Undo', async () => {
    const user = userEvent.setup();
    answer(ticketResponse({ assignee: ANNA, allowedActions: ['read', 'assign_self'] }));
    fake.on('PATCH /api/v1/tickets/{ticketId}', {
      data: ticketResponse({ assignee: null, version: 4, allowedActions: ['read', 'assign_self'] }),
    });
    renderView();

    await user.click(await screen.findByRole('button', { name: 'Unassign me' }));

    await waitFor(() => expect(lastToast()?.actionProps?.children).toBe('Undo'));
    expect(fake.callsTo('PATCH /api/v1/tickets/{ticketId}')[0]?.init).toMatchObject({
      body: { assigneeId: null },
    });
  });

  it('shows the assignee as text without assign and assign_self', async () => {
    answer(ticketResponse({ allowedActions: ['read', 'update'] }));
    renderView();

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Anna')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Assign to me' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
  });
});
