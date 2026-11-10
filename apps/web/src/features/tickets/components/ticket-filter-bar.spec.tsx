// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { TicketListFilters } from '@trybun/contracts/tickets';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { OPEN_TICKET_STATUSES } from '../ticket-list.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
// jsdom has no `matchMedia`: a tablet by default, a phone where a test says so.
const device = vi.hoisted(() => ({ isTablet: true }));
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY && device.isTablet,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

const { TicketFilterBar } = await import('./ticket-filter-bar.js');

const fake = createFakeApiClient();
api.current = fake.client;

const uuid = (number: number) => `0199a3f0-0000-7000-8000-${String(number).padStart(12, '0')}`;
const PROJECTS = [
  { id: uuid(1), key: 'ERP', name: 'ERP system' },
  { id: uuid(2), key: 'QM1', name: 'Quality one' },
  { id: uuid(150), key: 'QM150', name: 'Quality management' },
];
const PEOPLE = [
  { id: uuid(31), displayName: 'Anna', githubLogin: null },
  { id: uuid(32), displayName: 'Bruno', githubLogin: null },
];

type ListQuery = { state?: string; query?: string; id?: string[]; userId?: string[] };
const queryOf = (init: unknown) => (init as { params: { query: ListQuery } }).params.query;
const page = <Item,>(items: Item[], nextCursor: string | null = null) => ({
  data: { items, nextCursor },
});

/**
 * The lists of the pickers: the first page of a search holds only the first two projects – QM150
 * lies beyond it – while a lookup by ID finds every visible one.
 */
function answerLists() {
  fake.on('GET /api/v1/projects', (init) => {
    const { state, query, id } = queryOf(init);
    if (state === 'archived') {
      return page([]);
    }
    if (id !== undefined) {
      return page(PROJECTS.filter((project) => id.includes(project.id)));
    }
    const found = PROJECTS.filter(
      (project) =>
        query === undefined || `${project.key} ${project.name}`.toLowerCase().includes(query),
    );
    return query === undefined ? page(found.slice(0, 2), 'next') : page(found);
  });
  fake.on('GET /api/v1/organizations', page([]));
  fake.on('GET /api/v1/project-members', (init) => {
    const { userId } = queryOf(init);
    return page(userId === undefined ? PEOPLE : PEOPLE.filter(({ id }) => userId.includes(id)));
  });
}

/** The bar with its filters in state, as the list keeps them in the URL. */
function Bar({
  initial = {},
  onChange,
}: {
  initial?: TicketListFilters;
  onChange: (filters: TicketListFilters) => void;
}) {
  const [filters, setFilters] = useState(initial);
  return (
    <TicketFilterBar
      filters={filters}
      organizationsExist={false}
      onFiltersChange={(next) => {
        onChange(next);
        setFilters(next);
      }}
    />
  );
}

function renderBar(initial: TicketListFilters = {}) {
  const onChange = vi.fn();
  renderInApp(<Bar initial={initial} onChange={onChange} />);
  return onChange;
}

afterEach(() => {
  cleanup();
  fake.reset();
  device.isTablet = true;
});

describe('TicketFilterBar (#279)', () => {
  it('lists the fields under Add filter and opens the picker of one in place', async () => {
    answerLists();
    const events = userEvent.setup();
    renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    const fields = await screen.findByRole('list', { name: 'Filters' });
    expect(
      within(fields)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Project', 'Type', 'Status', 'Priority', 'Assignee', 'Source', 'Sharing request']);
    await events.click(within(fields).getByRole('button', { name: 'Project' }));

    // Opened with a mouse, the search input takes the focus (Q7).
    const input = await screen.findByRole('combobox', { name: 'Search projects…' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(await screen.findByRole('option', { name: 'ERP · ERP system' })).toBeDefined();
    expect(
      screen.getByRole('listbox', { name: 'Project' }).getAttribute('aria-multiselectable'),
    ).toBe('true');
    // More projects exist than the first page shows.
    expect(screen.getByRole('status').textContent).toContain('Type to find more');
  });

  it('narrows the projects by a search on the server and applies a choice at once', async () => {
    answerLists();
    const events = userEvent.setup();
    const onChange = renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    await events.click(await screen.findByRole('button', { name: 'Project' }));
    await events.type(await screen.findByRole('combobox', { name: 'Search projects…' }), 'qm1');

    const option = await screen.findByRole('option', { name: 'QM150 · Quality management' });
    expect(screen.queryByRole('option', { name: 'ERP · ERP system' })).toBeNull();
    expect(fake.callsTo('GET /api/v1/projects').map(({ init }) => queryOf(init))).toContainEqual(
      expect.objectContaining({ state: 'active', query: 'qm1' }),
    );
    await events.click(option);

    expect(onChange).toHaveBeenLastCalledWith({ projectId: [uuid(150)] });
    // The picker stays open for further choices, the chip names the choice by its key.
    expect(screen.getByRole('combobox', { name: 'Search projects…' })).toBeDefined();
    expect(
      await screen.findByRole('button', { name: 'Change filter Project: QM150' }),
    ).toBeDefined();
  });

  it('says when no project matches the search', async () => {
    answerLists();
    const events = userEvent.setup();
    renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    await events.click(await screen.findByRole('button', { name: 'Project' }));
    await events.type(await screen.findByRole('combobox', { name: 'Search projects…' }), 'zz');

    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('No projects match “zz”.'),
    );
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('reopens a picker from its chip with the chosen values pinned on top, also beyond the first page', async () => {
    answerLists();
    const events = userEvent.setup();
    renderBar({ projectId: [uuid(150), uuid(999)] });

    // The name of a project beyond the first search page comes from the lookup by ID; one the
    // person cannot see is "Unknown" (S1-13 Q5).
    const chip = await screen.findByRole('button', { name: 'Change filter Project: QM150 +1' });
    await events.click(chip);

    const listbox = await screen.findByRole('listbox', { name: 'Project' });
    await waitFor(() =>
      expect(
        within(listbox)
          .getAllByRole('option')
          .map((option) => option.textContent),
      ).toEqual(['QM150 · Quality management', 'Unknown', 'ERP · ERP system', 'QM1 · Quality one']),
    );
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.getAttribute('aria-selected')),
    ).toEqual(['true', 'true', 'false', 'false']);
  });

  it('removes a filter with the × of its chip', async () => {
    answerLists();
    const events = userEvent.setup();
    const onChange = renderBar({ projectId: [uuid(1)], priority: ['high'] });

    await events.click(await screen.findByRole('button', { name: 'Remove filter Priority: High' }));

    expect(onChange).toHaveBeenLastCalledWith({ projectId: [uuid(1)] });
    expect(screen.queryByRole('button', { name: /Priority/ })).toBeNull();
    // An active field is not offered again under Add filter.
    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    const fields = await screen.findByRole('list', { name: 'Filters' });
    expect(within(fields).queryByRole('button', { name: 'Project' })).toBeNull();
    expect(within(fields).getByRole('button', { name: 'Priority' })).toBeDefined();
  });

  it('shows the count of the values while their names cannot be looked up, never "Unknown"', async () => {
    answerLists();
    fake.on('GET /api/v1/projects', {
      status: 429,
      error: { type: 'about:blank', title: 'Too many', status: 429, code: 'request.rate_limited' },
    });
    renderBar({ projectId: [uuid(1), uuid(2)] });

    expect(await screen.findByRole('button', { name: 'Change filter Project: 2' })).toBeDefined();
  });

  it('offers Try again when the search is refused (429), and tries again on request', async () => {
    answerLists();
    fake.on('GET /api/v1/projects', {
      status: 429,
      error: { type: 'about:blank', title: 'Too many', status: 429, code: 'request.rate_limited' },
    });
    const events = userEvent.setup();
    renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    await events.click(await screen.findByRole('button', { name: 'Project' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('The options could not be loaded.');
    // A refusal is not retried on its own.
    expect(fake.callsTo('GET /api/v1/projects')).toHaveLength(2);
    answerLists();
    await events.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('option', { name: 'ERP · ERP system' })).toBeDefined();
  });

  it('offers Me and Unassigned and asks for projects before it offers people', async () => {
    answerLists();
    const events = userEvent.setup();
    const onChange = renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    await events.click(await screen.findByRole('button', { name: 'Assignee' }));

    const listbox = await screen.findByRole('listbox', { name: 'Assignee' });
    expect(
      within(listbox)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Me', 'Unassigned']);
    expect(screen.getByText('Choose projects to filter by their people.')).toBeDefined();
    expect(fake.callsTo('GET /api/v1/project-members')).toHaveLength(0);
    await events.click(within(listbox).getByRole('option', { name: 'Me' }));
    expect(onChange).toHaveBeenLastCalledWith({ assigneeId: ['me'] });
  });

  it('offers the people of the chosen projects at once', async () => {
    answerLists();
    const events = userEvent.setup();
    const onChange = renderBar({ projectId: [uuid(1)] });

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    await events.click(await screen.findByRole('button', { name: 'Assignee' }));
    await events.click(await screen.findByRole('option', { name: 'Bruno' }));

    expect(onChange).toHaveBeenLastCalledWith({ projectId: [uuid(1)], assigneeId: [uuid(32)] });
    expect(
      fake.callsTo('GET /api/v1/project-members').map(({ init }) => queryOf(init)),
    ).toContainEqual(expect.objectContaining({ projectId: [uuid(1)] }));
    expect(screen.queryByText('Choose projects to filter by their people.')).toBeNull();
    expect(
      await screen.findByRole('button', { name: 'Change filter Assignee: Bruno' }),
    ).toBeDefined();
  });

  it('chooses the open statuses with Open and filters the fixed options on the client', async () => {
    answerLists();
    const events = userEvent.setup();
    const onChange = renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    await events.click(await screen.findByRole('button', { name: 'Status' }));
    await events.click(await screen.findByRole('button', { name: 'Open' }));
    expect(onChange).toHaveBeenLastCalledWith({
      status: [...OPEN_TICKET_STATUSES],
    });
    expect(screen.getByRole('button', { name: 'Open' }).getAttribute('aria-pressed')).toBe('true');

    await events.type(screen.getByRole('combobox', { name: 'Search statuses…' }), 'rej');
    const listbox = screen.getByRole('listbox', { name: 'Status' });
    // The chosen statuses stay pinned; of the others only the matching one is offered.
    expect(within(listbox).getAllByRole('option', { selected: false })).toHaveLength(1);
    expect(within(listbox).getByRole('option', { name: 'Rejected' })).toBeDefined();
  });

  it('keeps the focus off the search input when a touch opens the picker (Q7)', async () => {
    answerLists();
    const events = userEvent.setup();
    renderBar({ priority: ['high'] });

    const chip = screen.getByRole('button', { name: 'Change filter Priority: High' });
    await events.pointer({ keys: '[TouchA]', target: chip });

    const input = await screen.findByRole('combobox', { name: 'Search priorities…' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).not.toBe(input);
  });

  it('keeps the focus off the search input when a field is touched in the field list (Q7)', async () => {
    answerLists();
    const events = userEvent.setup();
    renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    const field = await screen.findByRole('button', { name: 'Priority' });
    await events.pointer({ keys: '[TouchA]', target: field });

    const input = await screen.findByRole('combobox', { name: 'Search priorities…' });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(document.activeElement).not.toBe(input);
    // The popup keeps the focus, not the page behind it.
    expect(document.activeElement?.closest('[data-slot="popover-content"]')).not.toBeNull();
  });

  it('is one bottom sheet on phones: field list, picker with Back, and Done', async () => {
    device.isTablet = false;
    answerLists();
    const events = userEvent.setup();
    const onChange = renderBar();

    await events.click(screen.getByRole('button', { name: 'Add filter' }));
    const sheet = await screen.findByRole('dialog', { name: 'Filter tickets' });
    await events.click(within(sheet).getByRole('button', { name: 'Priority' }));

    expect(await screen.findByRole('dialog', { name: 'Priority' })).toBeDefined();
    await events.click(await screen.findByRole('option', { name: 'Critical' }));
    expect(onChange).toHaveBeenLastCalledWith({ priority: ['critical'] });

    await events.click(screen.getByRole('button', { name: 'Back to filters' }));
    const fields = await screen.findByRole('list', { name: 'Filters' });
    expect(within(fields).queryByRole('button', { name: 'Priority' })).toBeNull();

    await events.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change filter Priority: Critical' })).toBeDefined();
  });
});
