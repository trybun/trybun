// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { TicketListItem } from '@trybun/contracts/tickets';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { stateOfView, withFilters } from '../ticket-list.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));
const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
// A tablet: the table, selects instead of bottom sheets (jsdom has no `matchMedia`).
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const { TicketList } = await import('./ticket-list.js');

const fake = createFakeApiClient();
api.current = fake.client;

const ME = '0199a3f0-0000-7000-8000-000000000031';
const PROJECT = { id: '0199a3f0-0000-7000-8000-000000000010', key: 'ERP', name: 'ERP system' };

function ticket(number: number, overrides: Partial<TicketListItem> = {}): TicketListItem {
  return {
    id: `0199a3f0-0000-7000-8000-0000000001${String(number).padStart(2, '0')}`,
    projectId: PROJECT.id,
    project: PROJECT,
    number,
    identifier: `ERP-${number}`,
    title: `Ticket ${number}`,
    requester: { id: ME, displayName: 'Anna' },
    version: 3,
    createdAt: '2026-11-02T09:00:00.000Z',
    updatedAt: '2026-11-03T10:30:00.000Z',
    allowedActions: ['read', 'update', 'update_fields', 'assign', 'change_status'],
    publicStatus: 'in_progress',
    waitingReason: null,
    duplicateOf: null,
    visibility: 'only_me',
    sharingRequest: 'none',
    descriptionEditedAt: null,
    type: 'bug',
    source: 'developer',
    priority: 'high',
    status: 'in_progress',
    organization: null,
    assignee: { id: ME, displayName: 'Anna' },
    closedAt: null,
    ...overrides,
  };
}

function answerList(items: TicketListItem[]) {
  fake.on('GET /api/v1/tickets', { data: { items, nextCursor: null } });
  fake.on('GET /api/v1/projects', { data: { items: [], nextCursor: null } });
}

afterEach(() => {
  cleanup();
  fake.reset();
  toastAdd.mockClear();
  replace.mockClear();
});

describe('TicketList', () => {
  it('lists the tickets of the view in a table and asks the API with its filters and sort', async () => {
    answerList([ticket(1), ticket(2, { assignee: null, priority: 'critical' })]);
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    await screen.findAllByRole('link', { name: 'Ticket 1' });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('link', { name: /Ticket \d/ })).toHaveLength(2);
    expect(within(table).queryByRole('columnheader', { name: 'Organization' })).toBeNull();
    expect(
      within(table).getByRole('columnheader', { name: 'Priority' }).getAttribute('aria-sort'),
    ).toBe('descending');
    expect(fake.callsTo('GET /api/v1/tickets')[0]?.init).toMatchObject({
      params: { query: { assigneeId: ['me'], sort: 'priority', order: 'desc', limit: 50 } },
    });
  });

  it('names the view in its empty state and offers Clear filters for own filters', async () => {
    answerList([]);
    renderInApp(
      <TicketList
        state={withFilters(stateOfView('triage'), { priority: ['low'] })}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    expect(await screen.findByText('No tickets match these filters.')).toBeDefined();
    await userEvent.setup().click(screen.getAllByRole('button', { name: 'Clear filters' })[0]!);
    expect(replace).toHaveBeenCalledWith('/tickets?view=custom', { scroll: false });
  });

  it('sorts by a column header through the URL', async () => {
    answerList([ticket(1)]);
    renderInApp(
      <TicketList state={stateOfView('triage')} currentUserId={ME} organizationsExist={false} />,
    );

    await userEvent.setup().click(await screen.findByRole('button', { name: 'ID' }));
    expect(replace).toHaveBeenCalledWith('/tickets?view=triage&sort=identifier&order=desc', {
      scroll: false,
    });
  });

  it('reports a conflict of a bulk change per ticket and keeps that ticket selected (§8.1)', async () => {
    const events = userEvent.setup();
    const [first, second] = [ticket(1), ticket(2)];
    answerList([first, second]);
    fake.on('POST /api/v1/tickets/bulk-changes', {
      data: {
        results: [
          { id: first.id, status: 200, ticket: { ...first, priority: 'low', version: 4 } },
          { id: second.id, status: 412, code: 'request.precondition_failed' },
        ],
      },
    });
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    await screen.findAllByRole('link', { name: 'Ticket 1' });
    // jsdom applies no CSS, so the cards of phones are there too: the test uses the table.
    const table = screen.getByRole('table');
    await events.click(within(table).getByRole('checkbox', { name: 'Select ERP-1' }));
    await events.click(within(table).getByRole('checkbox', { name: 'Select ERP-2' }));
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByText('2 selected')).toBeDefined();
    await events.click(within(bar).getByRole('combobox', { name: 'Priority' }));
    await events.click(await screen.findByRole('option', { name: 'Low' }));

    const dialog = await screen.findByRole('dialog', { name: '1 of 2 tickets updated' });
    expect(
      within(dialog).getByText('Changed by someone else – reload to see the latest version'),
    ).toBeDefined();
    expect(fake.callsTo('POST /api/v1/tickets/bulk-changes')[0]?.init).toMatchObject({
      body: {
        tickets: [
          { id: first.id, version: 3 },
          { id: second.id, version: 3 },
        ],
        change: { field: 'priority', priority: 'low' },
      },
    });
    // The dialog is modal: the table behind it is hidden from the accessibility tree.
    const checkbox = (name: string) =>
      within(table).getByRole('checkbox', { name, hidden: true }).getAttribute('aria-checked');
    await waitFor(() => expect(checkbox('Select ERP-2')).toBe('true'));
    expect(checkbox('Select ERP-1')).toBe('false');
  });

  it('says in a toast how many tickets a fully successful bulk change updated', async () => {
    const events = userEvent.setup();
    const only = ticket(1);
    answerList([only]);
    fake.on('POST /api/v1/tickets/bulk-changes', {
      data: { results: [{ id: only.id, status: 200, ticket: { ...only, assignee: null } }] },
    });
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    await screen.findAllByRole('link', { name: 'Ticket 1' });
    await events.click(
      within(screen.getByRole('table')).getByRole('checkbox', { name: 'Select ERP-1' }),
    );
    await events.click(screen.getByRole('combobox', { name: 'Assignee' }));
    await events.click(await screen.findByRole('option', { name: 'Unassigned' }));

    await waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(
        expect.objectContaining({ title: '1 ticket updated', type: 'success' }),
      ),
    );
    expect(fake.callsTo('POST /api/v1/tickets/bulk-changes')[0]?.init).toMatchObject({
      body: { change: { field: 'assignee', assigneeId: null } },
    });
  });

  it('offers Approve and Refuse sharing in Pending sharing approvals by allowedActions (Q11)', async () => {
    answerList([
      ticket(1, {
        sharingRequest: 'pending',
        allowedActions: ['read', 'approve_sharing', 'reject_sharing'],
      }),
      ticket(2, { sharingRequest: 'pending', allowedActions: ['read'] }),
    ]);
    renderInApp(
      <TicketList
        state={stateOfView('pending_sharing_approvals')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    await screen.findAllByRole('link', { name: 'Ticket 1' });
    const table = screen.getByRole('table');
    // The actions sit in the title cell, never in a column behind horizontal scrolling (QA).
    const titleCell = within(table).getByRole('link', { name: 'Ticket 1' }).closest('td');
    expect(titleCell).not.toBeNull();
    expect(within(titleCell!).getByRole('button', { name: 'Approve sharing' })).toBeDefined();
    expect(within(table).getAllByRole('button', { name: 'Approve sharing' })).toHaveLength(1);
    expect(within(table).getAllByRole('button', { name: 'Refuse sharing' })).toHaveLength(1);
  });

  it('names a project from beyond the first page in its chip, and only an invisible one Unknown (#272)', async () => {
    const id = (number: number) => `0199a3f0-0000-7000-8000-${String(number).padStart(12, '0')}`;
    const projects = Array.from({ length: 150 }, (_, index) => ({
      id: id(index + 1),
      key: `P${index + 1}`,
      name: `Project ${index + 1}`,
    }));
    fake.on('GET /api/v1/tickets', { data: { items: [], nextCursor: null } });
    fake.on('GET /api/v1/projects', (init) => {
      const { state, cursor } = (init as { params: { query: { state: string; cursor?: string } } })
        .params.query;
      if (state === 'archived') {
        return { data: { items: [], nextCursor: null } };
      }
      return cursor === undefined
        ? { data: { items: projects.slice(0, 100), nextCursor: '100' } }
        : { data: { items: projects.slice(100), nextCursor: null } };
    });
    fake.on('GET /api/v1/projects/{projectId}/members', { data: { items: [], nextCursor: null } });
    renderInApp(
      <TicketList
        state={withFilters(stateOfView('triage'), { projectId: [id(150), id(999)] })}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    expect(await screen.findByText(/P150 · Project 150, Unknown/)).toBeDefined();
  });
});
