'use client';

import { cn } from 'cn';
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from 'lucide-react';
import { createContext, use, type ComponentProps } from 'react';
import { Button } from '@trybun/ui/components/button';

// A presentational table (§18.6): the feature renders rows and wires sorting and selection (e.g.
// TanStack Table) itself. The container scrolls sideways, so a wide table never widens the page
// on a 360 px phone (§2.9).
function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

function TableHeader({ className, ...props }: ComponentProps<'thead'>) {
  return <thead data-slot="table-header" className={cn('[&_tr]:border-b', className)} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return (
    <tbody
      data-slot="table-body"
      className={cn('[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
}

function TableFooter({ className, ...props }: ComponentProps<'tfoot'>) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
      {...props}
    />
  );
}

// A selected row has `data-state="selected"`; its checkbox is the cue besides the colour.
function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        'border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

/** The `aria-sort` values of a sortable column header. */
type TableSortDirection = 'ascending' | 'descending' | 'none';

const TableSortContext = createContext<TableSortDirection>('none');

// The cell of a checkbox is 44 px on phones and tablets, so the 44 px hit area of the checkbox
// stays inside its own row and column (§2.9); compact on desktop with a precise pointer, where
// the padding on both sides keeps the 16 px box 24 px clear of a sort button in the next header
// (WCAG 2.5.8 target size).
const CHECKBOX_CELL =
  '[&:has([role=checkbox])]:h-11 [&:has([role=checkbox])]:w-11 [&:has([role=checkbox])]:px-3.5 xl:pointer-fine:[&:has([role=checkbox])]:h-auto xl:pointer-fine:[&:has([role=checkbox])]:w-auto xl:pointer-fine:[&:has([role=checkbox])]:px-2';

/**
 * A column header. With `sortDirection` the column is sortable: the header carries `aria-sort`
 * and a `TableSortButton` inside it shows the direction.
 */
function TableHead({
  className,
  sortDirection,
  children,
  ...props
}: ComponentProps<'th'> & { sortDirection?: TableSortDirection }) {
  return (
    <th
      data-slot="table-head"
      aria-sort={sortDirection}
      className={cn(
        'h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground',
        CHECKBOX_CELL,
        className,
      )}
      {...props}
    >
      {sortDirection ? (
        <TableSortContext value={sortDirection}>{children}</TableSortContext>
      ) : (
        children
      )}
    </th>
  );
}

const SORT_ICONS = {
  ascending: ArrowUpIcon,
  descending: ArrowDownIcon,
  none: ArrowUpDownIcon,
} as const;

/**
 * The button of a sortable column header, inside a `TableHead` with `sortDirection`. Its
 * accessible name is the column name; the direction is announced through `aria-sort`. In the
 * label limit of the table (`table-label-limit-*`) its label wraps and the button grows with its
 * lines, keeping its touch target – 44 px, compact on a desktop with a precise pointer (§2.9).
 */
function TableSortButton({ className, children, ...props }: ComponentProps<typeof Button>) {
  const direction = use(TableSortContext);
  const Icon = SORT_ICONS[direction];
  return (
    <Button
      data-slot="table-sort-button"
      data-direction={direction}
      variant="ghost"
      size="sm"
      className={cn(
        '-mx-2 h-auto min-h-11 px-2 py-1 text-left text-sm xl:pointer-fine:h-auto xl:pointer-fine:min-h-7',
        className,
      )}
      {...props}
    >
      {children}
      <Icon
        aria-hidden
        data-icon="inline-end"
        className={cn(direction === 'none' && 'text-muted-foreground')}
      />
    </Button>
  );
}

function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return (
    <td
      data-slot="table-cell"
      className={cn('p-2 align-middle whitespace-nowrap', CHECKBOX_CELL, className)}
      {...props}
    />
  );
}

/**
 * The label of a cell or a header that cannot be sorted in a narrow column: in the label limit of
 * the table (`table-label-limit-*`) it is at most the limit wide and wraps; elsewhere it is plain
 * text.
 */
function TableCellLabel({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="table-cell-label" className={className} {...props} />;
}

function TableCaption({ className, ...props }: ComponentProps<'caption'>) {
  return (
    <caption
      data-slot="table-caption"
      className={cn('mt-4 text-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCellLabel,
  TableCaption,
  TableSortButton,
  type TableSortDirection,
};
