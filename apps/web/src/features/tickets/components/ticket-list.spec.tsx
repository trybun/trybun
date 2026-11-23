// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { TicketListItem } from '@trybun/contracts/tickets';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient, laterPagesFail } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { rateLimitedResult } from '../../../../test/factories/rate-limited.factory.js';
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
vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/tickets',
  useSearchParams: () => new URLSearchParams('view=triage'),
}));
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
const answerRoute = fake.client.GET.getMockImplementation()!;

/**
 * Refuses the reads of the tickets – only those of a later page with `laterPages` – with `429` and
 * its `Retry-After: 45` (§14.4); the projects of the filters answer their route.
 */
function refuseTickets({ laterPages = false } = {}) {
  fake.client.GET.mockImplementation((route: string, init?: unknown) =>
    route === '/api/v1/tickets' &&
    (!laterPages ||
      (init as { params?: { query?: { cursor?: string } } }).params?.query?.cursor !== undefined)
      ? rateLimitedResult()
      : answerRoute(route, init),
  );
}

/** The notice of a refused read (#433): `h2` under the `h1` of the page, the wait, Reload page. */
async function expectRateLimitedAlert(reloadHref: string | null) {
  const alert = await screen.findByRole('alert');
  expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe('Too many requests');
  expect(alert.textContent).toContain('Try again in 45 seconds.');
  expect(alert.textContent).not.toContain('The tickets could not be loaded.');
  const reload = within(alert).queryByRole('link', { name: 'Reload page' });
  expect(reload?.getAttribute('href') ?? null).toBe(reloadHref);
}

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
  fake.client.GET.mockImplementation(answerRoute);
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

  it('shows the type next to the identifier on a card and below the title in the table (§8.1)', async () => {
    answerList([ticket(1), ticket(2, { type: null })]);
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    // The cards of phones: the separator is hidden, so the link's name is the identifier, the
    // type and the title, in this order.
    const cards = await screen.findByRole('list');
    expect(within(cards).getByRole('link', { name: 'ERP-1 Bug Ticket 1' })).toBeDefined();
    expect(within(cards).getByRole('link', { name: 'ERP-2 Not set Ticket 2' })).toBeDefined();
    expect(within(cards).getAllByText('·')[0]?.getAttribute('aria-hidden')).toBe('true');

    // The table: the title cell shows the type below the title (hidden from `xl` on by CSS,
    // checked in E2E), the ID cell only the identifier, and the type column stays.
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    const cell = (row: HTMLElement, index: number) => within(row).getAllByRole('cell')[index];
    expect(cell(rows[1]!, 1)?.textContent).toBe('ERP-1');
    expect(cell(rows[1]!, 2)?.textContent).toBe('Ticket 1Bug');
    expect(cell(rows[2]!, 2)?.textContent).toBe('Ticket 2Not set');
    expect(within(rows[2]!).getAllByText('Not set')).toHaveLength(2);
  });

  it('says the tickets are loading until the read settles, never the empty state (#428)', async () => {
    fake.on('GET /api/v1/projects', { data: { items: [], nextCursor: null } });
    const answer = fake.hold('GET /api/v1/tickets');
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    expect((await screen.findByRole('status')).textContent).toBe('Loading tickets…');
    expect(screen.queryByText('No open tickets are assigned to you.')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();

    answer({ data: { items: [ticket(1)], nextCursor: null } });
    await screen.findAllByRole('link', { name: 'Ticket 1' });
    expect(screen.queryByRole('status')).toBeNull();
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

  it('says which filter of the address kept only its first 50 values (#291)', async () => {
    answerList([ticket(1)]);
    renderInApp(
      <TicketList
        state={stateOfView('custom')}
        currentUserId={ME}
        organizationsExist={false}
        filtersOverLimit={['projectId']}
      />,
    );

    expect(
      await screen.findByText(
        'Project: only the first 50 values are used – a filter takes up to 50 values.',
      ),
    ).toBeDefined();
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

  it('limits the labels of the narrow columns, so a long translation wraps (#295)', async () => {
    answerList([ticket(1, { status: 'waiting_for_requester', assignee: null })]);
    renderInApp(
      <TicketList state={stateOfView('custom')} currentUserId={ME} organizationsExist={false} />,
    );

    await screen.findAllByRole('link', { name: 'Ticket 1' });
    const table = screen.getByRole('table');
    const row = within(table).getAllByRole('row')[1]!;
    // The table limits its narrow columns on tablets and narrow desktops (`table-label-limit-*` of
    // `@trybun/ui`); the size of the layout is checked in E2E and in the stories of the table.
    expect(table.getAttribute('class')?.split(' ')).toEqual(
      expect.arrayContaining(['max-lg:table-label-limit-21', 'xl:max-2xl:table-label-limit-21']),
    );
    // Status, priority, type, assignee, project and last update: a label at most 84 px wide that
    // wraps a long word instead of widening the table.
    for (const text of ['Waiting for requester', 'High', 'Bug', 'Unassigned', 'ERP system']) {
      const label = within(row)
        .getAllByText(text)
        .at(-1)
        ?.closest('[data-slot="table-cell-label"]');
      expect(label, text).not.toBeNull();
    }
    expect(row.querySelector('time')?.closest('[data-slot="table-cell-label"]')).not.toBeNull();
    // The sort buttons of the headers wrap too and keep their touch target.
    for (const name of ['ID', 'Status', 'Priority', 'Updated']) {
      const button = within(table).getByRole('button', { name });
      expect(button.getAttribute('data-slot'), name).toBe('table-sort-button');
      expect(button.getAttribute('class')?.split(' '), name).toEqual(
        expect.arrayContaining(['min-h-11', 'xl:pointer-fine:h-auto', 'xl:pointer-fine:min-h-7']),
      );
    }
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

  describe('the people of the bulk Assignee (#471)', () => {
    const JAN = {
      id: '0199a3f0-0000-7000-8000-000000000032',
      displayName: 'Jan',
      githubLogin: null,
    };
    const members = {
      data: {
        items: [{ user: JAN, role: 'developer', createdAt: '2026-11-01T09:00:00.000Z' }],
        nextCursor: null,
      },
    };

    /** Selects a ticket, the read of its project's people answering `reply`. */
    async function selectTicket(reply: Parameters<typeof fake.on>[1] = members) {
      const events = userEvent.setup();
      answerList([ticket(1)]);
      fake.on('GET /api/v1/projects/{projectId}/members', reply);
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
      return { events, bar: screen.getByRole('region', { name: 'Bulk actions' }) };
    }

    it('says in the bar when to try again a refused read, and reads the people again', async () => {
      fake.refuse('GET /api/v1/projects/{projectId}/members');
      const { events, bar } = await selectTicket();

      const alert = await within(bar).findByRole('alert');
      // `h2` like the errors of the list; **Try again** reads the people again, so no **Reload
      // page**, which would drop the selection.
      expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe(
        'Too many requests',
      );
      expect(alert.textContent).toContain('Try again in 45 seconds.');
      expect(within(alert).queryByRole('link')).toBeNull();
      fake.answer('GET /api/v1/projects/{projectId}/members');
      await events.click(within(bar).getByRole('button', { name: 'Try again' }));
      await waitFor(() => expect(within(bar).queryByRole('alert')).toBeNull());
      await events.click(within(bar).getByRole('combobox', { name: 'Assignee' }));
      expect(await screen.findByRole('option', { name: 'Jan' })).toBeDefined();
    });

    it('shows the message of a failed read in the bar, and keeps Assign to me and Unassigned', async () => {
      const { events, bar } = await selectTicket({ status: 500, error: {} });

      expect((await within(bar).findByRole('alert')).textContent).toBe(
        'Something went wrong. Try again later.',
      );
      expect(within(bar).getByRole('button', { name: 'Try again' })).toBeDefined();
      await events.click(within(bar).getByRole('combobox', { name: 'Assignee' }));
      const options = await screen.findAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['Assign to me', 'Unassigned']);
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
    // The actions shrink and wrap their labels inside the cell in every language, and grow with
    // the lines also at the compact desktop size (#296).
    for (const name of ['Approve sharing', 'Refuse sharing']) {
      const action = within(titleCell!).getByRole('button', { name });
      expect(action.className.split(' ')).toEqual(
        expect.arrayContaining([
          'shrink',
          'whitespace-normal',
          'wrap-anywhere',
          'xl:pointer-fine:h-auto',
        ]),
      );
      expect(action.className.split(' ')).not.toContain('shrink-0');
    }
  });

  it('keeps the loaded rows when Show more fails and shows the error above it (#434)', async () => {
    fake.on('GET /api/v1/tickets', laterPagesFail([ticket(1)]));
    fake.on('GET /api/v1/projects', { data: { items: [], nextCursor: null } });
    const events = userEvent.setup();
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    await events.click(await screen.findByRole('button', { name: 'Show more' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('The tickets could not be loaded.');
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'Ticket 1' })).toBeDefined();
    expect(alert.nextElementSibling).toBe(screen.getByRole('button', { name: 'Show more' }));
  });

  it('shows the wait and Reload page with the filters of the address for a refused read (#433)', async () => {
    answerList([]);
    refuseTickets();
    renderInApp(
      <TicketList state={stateOfView('triage')} currentUserId={ME} organizationsExist={false} />,
    );

    // The query string keeps the view and the filters.
    await expectRateLimitedAlert('/tickets?view=triage');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows the wait above Show more for a refused later page, without Reload page (#433)', async () => {
    answerList([]);
    fake.on('GET /api/v1/tickets', { data: { items: [ticket(1)], nextCursor: 'next' } });
    refuseTickets({ laterPages: true });
    const events = userEvent.setup();
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    await events.click(await screen.findByRole('button', { name: 'Show more' }));

    // Show more tries the page again and keeps the loaded rows (#434).
    await expectRateLimitedAlert(null);
    expect(within(screen.getByRole('table')).getByRole('link', { name: 'Ticket 1' })).toBeDefined();
  });

  it('shows its own message for another failure of the first read (#433)', async () => {
    answerList([]);
    fake.on('GET /api/v1/tickets', { status: 500, error: {} });
    renderInApp(
      <TicketList
        state={stateOfView('my_open_tickets')}
        currentUserId={ME}
        organizationsExist={false}
      />,
    );

    expect((await screen.findByRole('alert')).textContent).toBe('The tickets could not be loaded.');
  });

  it('keeps the rows of the last filters while the next ones load (#279)', async () => {
    answerList([ticket(1)]);
    const before = withFilters(stateOfView('triage'), { priority: ['high'] });
    const after = withFilters(stateOfView('triage'), { priority: ['high', 'low'] });
    function Harness() {
      const [state, setState] = useState(before);
      return (
        <>
          <button type="button" onClick={() => setState(after)}>
            Next filters
          </button>
          <TicketList state={state} currentUserId={ME} organizationsExist={false} />
        </>
      );
    }
    renderInApp(<Harness />);
    await screen.findAllByRole('link', { name: 'Ticket 1' });

    let answer: (reply: unknown) => void = () => undefined;
    fake.client.GET.mockImplementationOnce(
      () => new Promise((resolve) => (answer = resolve)) as never,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next filters' }));

    // The next page is on its way (the stand-in answers later, unrecorded): the rows stay, the
    // results are marked busy.
    await waitFor(() => {
      const [path, init] = fake.client.GET.mock.lastCall ?? [];
      expect(path).toBe('/api/v1/tickets');
      expect(init).toMatchObject({ params: { query: { priority: ['high', 'low'] } } });
    });
    expect(screen.getAllByRole('link', { name: 'Ticket 1' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('table').closest('[aria-busy]')?.getAttribute('aria-busy')).toBe(
      'true',
    );

    answer({
      data: { items: [ticket(2)], nextCursor: null },
      response: new Response(null, { status: 200 }),
    });
    await screen.findAllByRole('link', { name: 'Ticket 2' });
    expect(screen.queryByRole('link', { name: 'Ticket 1' })).toBeNull();
  });
});
