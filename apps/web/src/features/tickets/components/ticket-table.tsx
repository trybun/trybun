'use client';

import type { TicketListItem } from '@trybun/contracts/tickets';
import { Checkbox } from '@trybun/ui/components/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableCellLabel,
  TableHead,
  TableHeader,
  TableRow,
  TableSortButton,
  type TableSortDirection,
} from '@trybun/ui/components/table';
import { cn } from '@trybun/ui/lib/utils';
import { useTranslations } from 'next-intl';
import type { TicketListSorting } from '../ticket-list.js';
import { MAX_BULK_CHANGE_TICKETS } from '../ticket-list.js';
import {
  COLUMN_CLASS,
  SORT_OF_COLUMN,
  TicketCheckbox,
  type TicketTable as TicketTableInstance,
} from './ticket-list-columns.js';

function directionOf(sorting: TicketListSorting, columnId: string): TableSortDirection | undefined {
  const sort = SORT_OF_COLUMN[columnId];
  if (sort === undefined) {
    return undefined;
  }
  if (sort !== sorting.sort) {
    return 'none';
  }
  return sorting.order === 'asc' ? 'ascending' : 'descending';
}

/**
 * The header checkbox: selects the loaded tickets, at most 100 (§8.1), or clears the selection
 * while some are selected.
 */
function SelectAllCheckbox({ table }: { table: TicketTableInstance }) {
  const t = useTranslations('tickets.list.selection');
  const rows = table.getRowModel().rows;
  const count = Object.keys(table.state.rowSelection).length;
  const isAll = count > 0 && count === Math.min(rows.length, MAX_BULK_CHANGE_TICKETS);
  return (
    <Checkbox
      checked={isAll}
      indeterminate={count > 0 && !isAll}
      aria-label={t('selectAll')}
      disabled={rows.length === 0}
      onCheckedChange={() =>
        table.setRowSelection(
          count > 0
            ? {}
            : Object.fromEntries(
                rows.slice(0, MAX_BULK_CHANGE_TICKETS).map((row) => [row.id, true]),
              ),
        )
      }
    />
  );
}

/**
 * The list as a table on tablets and desktops (§8.1, §18.5): rendered from the table's row model
 * and selection, like the cards of phones. A sortable column's header is a button with
 * `aria-sort`; `onSort` changes the URL.
 */
export function TicketTable({
  table,
  sorting,
  onSort,
  rowActions,
}: {
  table: TicketTableInstance;
  sorting: TicketListSorting;
  onSort: (columnId: string) => void;
  rowActions?: (ticket: TicketListItem) => React.ReactNode;
}) {
  return (
    // The narrow columns are limited where they would not fit otherwise (#295): the tablet widths
    // below `lg` (four narrow columns) and the desktop widths from `xl` to `2xl` (seven). With the
    // cell padding a column is then at most 100 px wide (44 + 83 + 112 + 4 × 100 ≤ 656 px at
    // 768 px; 32 + 83 + 112 + 7 × 100 ≤ 992 px at 1280 px), so the table fits in every language.
    <Table className="max-lg:table-label-limit-21 xl:max-2xl:table-label-limit-21">
      <TableHeader>
        {table.getHeaderGroups().map((group) => (
          <TableRow key={group.id}>
            {group.headers.map((header) => {
              const direction = directionOf(sorting, header.column.id);
              return (
                <TableHead
                  key={header.id}
                  sortDirection={direction}
                  className={COLUMN_CLASS[header.column.id]}
                >
                  {header.column.id === 'select' ? (
                    <SelectAllCheckbox table={table} />
                  ) : direction === undefined ? (
                    <TableCellLabel>
                      <table.FlexRender header={header} />
                    </TableCellLabel>
                  ) : (
                    <TableSortButton type="button" onClick={() => onSort(header.column.id)}>
                      <table.FlexRender header={header} />
                    </TableSortButton>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const isSelected = row.getIsSelected();
          return (
            <TableRow key={row.id} data-state={isSelected ? 'selected' : undefined}>
              {row.getAllCells().map((cell) => (
                <TableCell key={cell.id} className={cn(COLUMN_CLASS[cell.column.id])}>
                  {cell.column.id === 'select' ? (
                    <TicketCheckbox table={table} ticket={row.original} isSelected={isSelected} />
                  ) : cell.column.id === 'title' && rowActions !== undefined ? (
                    // The row actions sit under the title, as on the cards of phones, so they
                    // are never behind horizontal scrolling (S1-13 QA).
                    <div className="flex flex-col gap-2">
                      <table.FlexRender cell={cell} />
                      {rowActions(row.original)}
                    </div>
                  ) : (
                    <table.FlexRender cell={cell} />
                  )}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
