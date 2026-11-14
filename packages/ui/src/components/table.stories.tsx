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
  TableCellLabel,
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

/**
 * A selection column before a sortable column, as in the ticket list: the checkbox keeps the
 * spacing of a small target to the sort button next to it (WCAG 2.5.8).
 */
function SelectableSortableTable() {
  // As narrow as its content, like a table of many columns: no width is left to share out.
  return (
    <Table className="w-auto">
      <TableCaption>Selectable and sortable tickets</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>
            <Checkbox aria-label="Select all sortable tickets" />
          </TableHead>
          <TableHead sortDirection="ascending">
            <TableSortButton>Identifier</TableSortButton>
          </TableHead>
          <TableHead sortDirection="none">
            <TableSortButton>Title</TableSortButton>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TICKETS.map((ticket) => (
          <TableRow key={ticket.identifier}>
            <TableCell>
              <Checkbox aria-label={`Select sortable ${ticket.identifier}`} />
            </TableCell>
            <TableCell className="font-medium">{ticket.identifier}</TableCell>
            <TableCell>{ticket.title}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Selection and sorting together, shown in the three viewports. */
function Overview() {
  return (
    <div className="flex flex-col gap-8">
      <SelectableTable />
      <SortableTable />
      <SelectableSortableTable />
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

const LIMITED_TICKETS = [
  { identifier: 'TRY-5', title: 'Export the report as PDF', status: 'New' },
  {
    identifier: 'TRY-6',
    title: 'Log-in fails after a password change',
    status: 'Waiting for the reporter’s answer',
  },
  { identifier: 'TRY-7', title: 'Add a dark theme', status: 'Internationalization' },
];

/**
 * A table with a full-width title column and narrow columns in the label limit (§18.6), set for
 * the phone and tablet widths and the narrow desktop widths as in the ticket list: a long header
 * and long cell labels wrap within 84 px – the sort button within 100 px – instead of
 * widening the table, while a short label stays on one line.
 */
function LabelLimitTable() {
  return (
    <Table className="max-lg:table-label-limit-21 xl:max-2xl:table-label-limit-21">
      <TableCaption>Tickets in the label limit</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-full min-w-28 whitespace-normal">Title</TableHead>
          <TableHead className="whitespace-normal">
            <TableCellLabel>Current status</TableCellLabel>
          </TableHead>
          <TableHead sortDirection="descending" className="whitespace-normal">
            <TableSortButton>Identification</TableSortButton>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {LIMITED_TICKETS.map((ticket) => (
          <TableRow key={ticket.identifier}>
            <TableCell className="whitespace-normal">{ticket.title}</TableCell>
            <TableCell className="whitespace-normal">
              <TableCellLabel>{ticket.status}</TableCellLabel>
            </TableCell>
            <TableCell className="whitespace-normal">
              <TableCellLabel>{ticket.identifier}</TableCellLabel>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// The table fits its container in every viewport: the labels stay within the limit, a short one
// on a single line, and the sort button keeps its touch target (§2.9).
async function expectLabelLimit(canvasElement: HTMLElement, minButtonHeight: number) {
  const container = canvasElement.querySelector<HTMLElement>('[data-slot="table-container"]');
  await expect(container?.scrollWidth).toBeLessThanOrEqual(container?.clientWidth ?? 0);
  const labels = canvasElement.querySelectorAll<HTMLElement>('[data-slot="table-cell-label"]');
  for (const label of labels) {
    await expect(label.getBoundingClientRect().width).toBeLessThanOrEqual(84);
  }
  const short = within(canvasElement).getByText('New');
  await expect(short.getClientRects()).toHaveLength(1);
  await expect(short.getBoundingClientRect().height).toBeLessThanOrEqual(
    parseFloat(getComputedStyle(short).lineHeight),
  );
  const button = within(canvasElement).getByRole('button', { name: 'Identification' });
  const box = button.getBoundingClientRect();
  await expect(box.width).toBeLessThanOrEqual(100);
  await expect(box.height).toBeGreaterThanOrEqual(minButtonHeight);
  // The long word wraps inside the button, which grows with its lines instead of overflowing.
  await expect(box.height).toBeGreaterThan(minButtonHeight);
  await expect(button.scrollWidth).toBeLessThanOrEqual(button.clientWidth);
  await expect(button.scrollHeight).toBeLessThanOrEqual(button.clientHeight);
}

export const LabelLimitPhone: Story = {
  render: () => <LabelLimitTable />,
  globals: viewport('phone'),
  play: async ({ canvasElement }) => expectLabelLimit(canvasElement, 44),
};

export const LabelLimitTablet: Story = {
  render: () => <LabelLimitTable />,
  globals: viewport('tablet'),
  play: async ({ canvasElement }) => expectLabelLimit(canvasElement, 44),
};

export const LabelLimitDesktop: Story = {
  render: () => <LabelLimitTable />,
  globals: viewport('desktop'),
  // Compact with a precise pointer on a desktop.
  play: async ({ canvasElement }) => expectLabelLimit(canvasElement, 28),
};
