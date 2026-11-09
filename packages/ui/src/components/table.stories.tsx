import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, within } from 'storybook/test';
import { viewport } from '../../.storybook/viewports.js';
import { Checkbox } from './checkbox.js';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  TableSortButton,
  type TableSortDirection,
} from './table.js';

type Ticket = { identifier: string; title: string; status: string; priority: number };

const TICKETS: Ticket[] = [
  { identifier: 'TRY-3', title: 'Export the report as PDF', status: 'Open', priority: 2 },
  {
    identifier: 'TRY-1',
    title: 'Log-in fails after a password change',
    status: 'New',
    priority: 1,
  },
  { identifier: 'TRY-2', title: 'Add a dark theme', status: 'Resolved', priority: 3 },
];

const LONG_TITLE =
  'The invoice of the second quarter shows the net amounts of every line twice when it is exported from the archive of a closed project';

const meta = {
  title: 'Components/Table',
  component: Table,
} satisfies Meta<typeof Table>;

export default meta;

type Story = StoryObj<typeof meta>;

const ticketRow = (ticket: Ticket) => (
  <TableRow key={ticket.identifier}>
    <TableCell className="font-medium">{ticket.identifier}</TableCell>
    <TableCell>{ticket.title}</TableCell>
    <TableCell>{ticket.status}</TableCell>
    <TableCell className="text-right">{ticket.priority}</TableCell>
  </TableRow>
);

const headerRow = (
  <TableRow>
    <TableHead>Identifier</TableHead>
    <TableHead>Title</TableHead>
    <TableHead>Status</TableHead>
    <TableHead className="text-right">Priority</TableHead>
  </TableRow>
);

export const Default: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Tickets of the team</TableCaption>
      <TableHeader>{headerRow}</TableHeader>
      <TableBody>{TICKETS.map(ticketRow)}</TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Tickets</TableCell>
          <TableCell className="text-right">{TICKETS.length}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Tickets of the team' });
    await expect(within(table).getAllByRole('columnheader')).toHaveLength(4);
    // A header row, three tickets and the footer.
    await expect(within(table).getAllByRole('row')).toHaveLength(5);
  },
};

function SelectableTable() {
  const [selected, select] = useState<string[]>(['TRY-2']);
  const isAll = selected.length === TICKETS.length;
  return (
    <Table>
      <TableCaption>Tickets of the team</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox
              aria-label="Select all tickets"
              checked={isAll}
              indeterminate={selected.length > 0 && !isAll}
              onCheckedChange={(checked) => select(checked ? TICKETS.map((t) => t.identifier) : [])}
            />
          </TableHead>
          <TableHead>Identifier</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TICKETS.map((ticket) => {
          const isSelected = selected.includes(ticket.identifier);
          return (
            <TableRow key={ticket.identifier} data-state={isSelected ? 'selected' : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${ticket.identifier}`}
                  checked={isSelected}
                  onCheckedChange={(checked) =>
                    select(
                      checked
                        ? [...selected, ticket.identifier]
                        : selected.filter((id) => id !== ticket.identifier),
                    )
                  }
                />
              </TableCell>
              <TableCell className="font-medium">{ticket.identifier}</TableCell>
              <TableCell>{ticket.title}</TableCell>
              <TableCell>{ticket.status}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/** Selection checkboxes: a selected row has `data-state="selected"` and a checked checkbox. */
export const WithSelection: Story = {
  render: () => <SelectableTable />,
  play: async ({ canvas, userEvent }) => {
    const row = (name: string) => canvas.getByRole('checkbox', { name }).closest('tr');
    await expect(row('Select TRY-2')).toHaveAttribute('data-state', 'selected');
    await expect(row('Select TRY-1')).not.toHaveAttribute('data-state');
    const selectAll = canvas.getByRole('checkbox', { name: 'Select all tickets' });
    await expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select TRY-1' }));
    await expect(row('Select TRY-1')).toHaveAttribute('data-state', 'selected');

    await userEvent.click(selectAll);
    await expect(selectAll).toBeChecked();
    for (const checkbox of canvas.getAllByRole('checkbox')) await expect(checkbox).toBeChecked();

    await userEvent.click(selectAll);
    await expect(canvas.getByRole('checkbox', { name: 'Select TRY-2' })).not.toBeChecked();
  },
};

type SortKey = 'identifier' | 'title' | 'priority';

function SortableTable() {
  const [sort, setSort] = useState<{ key: SortKey; direction: 'ascending' | 'descending' }>({
    key: 'identifier',
    direction: 'ascending',
  });
  const directionOf = (key: SortKey): TableSortDirection =>
    sort.key === key ? sort.direction : 'none';
  const toggle = (key: SortKey) =>
    setSort({
      key,
      direction: sort.key === key && sort.direction === 'ascending' ? 'descending' : 'ascending',
    });
  const rows = TICKETS.toSorted((a, b) => {
    const order = String(a[sort.key]).localeCompare(String(b[sort.key]), 'en', { numeric: true });
    return sort.direction === 'ascending' ? order : -order;
  });
  const sortable = (key: SortKey, label: string) => (
    <TableHead sortDirection={directionOf(key)}>
      <TableSortButton onClick={() => toggle(key)}>{label}</TableSortButton>
    </TableHead>
  );
  return (
    <Table>
      <TableCaption>Tickets of the team</TableCaption>
      <TableHeader>
        <TableRow>
          {sortable('identifier', 'Identifier')}
          {sortable('title', 'Title')}
          <TableHead>Status</TableHead>
          {sortable('priority', 'Priority')}
        </TableRow>
      </TableHeader>
      <TableBody>{rows.map(ticketRow)}</TableBody>
    </Table>
  );
}

const firstIdentifier = (canvas: HTMLElement) =>
  within(canvas).getAllByRole('row')[1]?.querySelector('td')?.textContent;

/** Sortable headers: a button inside each header, `aria-sort` on the header itself. */
export const Sortable: Story = {
  render: () => <SortableTable />,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const header = (name: string) => canvas.getByRole('columnheader', { name });
    await expect(header('Identifier')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header('Priority')).toHaveAttribute('aria-sort', 'none');
    // A header that cannot be sorted has neither `aria-sort` nor a button.
    await expect(header('Status')).not.toHaveAttribute('aria-sort');
    await expect(canvas.queryByRole('button', { name: 'Status' })).toBeNull();
    await expect(firstIdentifier(canvasElement)).toBe('TRY-1');

    await userEvent.click(canvas.getByRole('button', { name: 'Identifier' }));
    await expect(header('Identifier')).toHaveAttribute('aria-sort', 'descending');
    await expect(firstIdentifier(canvasElement)).toBe('TRY-3');

    await userEvent.click(canvas.getByRole('button', { name: 'Priority' }));
    await expect(header('Priority')).toHaveAttribute('aria-sort', 'ascending');
    await expect(header('Identifier')).toHaveAttribute('aria-sort', 'none');
    await expect(firstIdentifier(canvasElement)).toBe('TRY-1');
  },
};

export const SortKeyboard: Story = {
  render: () => <SortableTable />,
  play: async ({ canvas, userEvent }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Identifier' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('columnheader', { name: 'Identifier' })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
  },
};

/** No rows: one cell across all columns tells why the table is empty. */
export const Empty: Story = {
  render: (args) => (
    <Table {...args}>
      <TableCaption>Tickets of the team</TableCaption>
      <TableHeader>{headerRow}</TableHeader>
      <TableBody>
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
            No tickets match the filters.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('cell', { name: 'No tickets match the filters.' }),
    ).toHaveAttribute('colspan', '4');
  },
};

/** A long title is cut off with an ellipsis; the whole text stays in the accessible name. */
export const LongText: Story = {
  render: (args) => (
    <Table {...args}>
      <TableHeader>{headerRow}</TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">TRY-4</TableCell>
          <TableCell className="max-w-64 truncate">{LONG_TITLE}</TableCell>
          <TableCell>Open</TableCell>
          <TableCell className="text-right">2</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
  play: async ({ canvas }) => {
    const cell = canvas.getByRole('cell', { name: LONG_TITLE });
    await expect(cell.scrollWidth).toBeGreaterThan(cell.clientWidth);
    await expect(getComputedStyle(cell).textOverflow).toBe('ellipsis');
  },
};

/** Selection and sorting together, shown in the three viewports. */
function Overview() {
  return (
    <div className="flex flex-col gap-8">
      <SelectableTable />
      <SortableTable />
    </div>
  );
}

// The hit area of a checkbox, the cell around it and the sort buttons are at least 44 px on
// phones and tablets (§2.9).
async function expectTouchTargets(canvas: HTMLElement) {
  const scope = within(canvas);
  for (const checkbox of scope.getAllByRole('checkbox')) {
    const hit = getComputedStyle(checkbox, '::after');
    await expect(parseFloat(hit.height)).toBeGreaterThanOrEqual(44);
    await expect(parseFloat(hit.width)).toBeGreaterThanOrEqual(44);
    const cell = checkbox.closest('td, th');
    await expect(cell?.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
    await expect(cell?.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
  }
  for (const button of scope.getAllByRole('button')) {
    await expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  }
}

export const Phone: Story = {
  render: () => <Overview />,
  globals: viewport('phone'),
  play: async ({ canvasElement }) => {
    await expectTouchTargets(canvasElement);
    // The table scrolls inside its container instead of widening the page.
    const container = canvasElement.querySelector<HTMLElement>('[data-slot="table-container"]');
    await expect(container?.scrollWidth).toBeGreaterThan(container?.clientWidth ?? 0);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
};

export const Tablet: Story = {
  render: () => <Overview />,
  globals: viewport('tablet'),
  play: async ({ canvasElement }) => expectTouchTargets(canvasElement),
};

export const Desktop: Story = {
  render: () => <Overview />,
  globals: viewport('desktop'),
};
