'use client';

import {
  createColumnHelper,
  rowSelectionFeature,
  tableFeatures,
  type ReactTable,
  type RowSelectionState,
} from '@tanstack/react-table';
import type { TicketListItem, TicketListSort } from '@trybun/contracts/tickets';
import { Badge } from '@trybun/ui/components/badge';
import { Checkbox } from '@trybun/ui/components/checkbox';
import Link from 'next/link';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { MAX_BULK_CHANGE_TICKETS } from '../ticket-list.js';

/** The features of the list's table (§18.5): the selection of the bulk actions. */
export const TICKET_TABLE_FEATURES = tableFeatures({ rowSelectionFeature });
export type TicketTable = ReactTable<typeof TICKET_TABLE_FEATURES, TicketListItem>;

const helper = createColumnHelper<typeof TICKET_TABLE_FEATURES, TicketListItem>();

/** The address of a ticket's view (S1-10). */
export function ticketHref(ticket: Pick<TicketListItem, 'identifier'>): string {
  return `/tickets/${ticket.identifier}`;
}

/** The sort key of the sortable columns; the other columns are not sortable (Q8). */
export const SORT_OF_COLUMN: Readonly<Partial<Record<string, TicketListSort>>> = {
  identifier: 'identifier',
  status: 'status',
  priority: 'priority',
  updated: 'updatedAt',
};

/**
 * The classes of the columns (§2.9): the text of every column but the checkbox and the
 * identifier wraps, so the table fits the content area from the tablet width on and nothing –
 * above all the row actions in the title cell – hides behind horizontal scrolling. The title
 * takes the remaining width. Tablets hide type, project and organization; they are shown from
 * the desktop width on. Until then the title cell shows the type below the title.
 */
export const COLUMN_CLASS: Readonly<Partial<Record<string, string>>> = {
  title: 'w-full min-w-28 whitespace-normal',
  status: 'whitespace-normal',
  priority: 'whitespace-normal',
  type: 'hidden whitespace-normal xl:table-cell',
  assignee: 'whitespace-normal',
  project: 'hidden whitespace-normal xl:table-cell',
  organization: 'hidden whitespace-normal xl:table-cell',
  updated: 'whitespace-normal',
};

/**
 * A label of a narrow column (#295). The title column takes all free width, so every other column
 * is only as wide as its longest unbreakable word – a translation such as „Oczekuje na
 * zgłaszającego” or „Zaktualizowano” widened the table at 768 px, and at 1280 px once the
 * organization column shows. Where the columns would not fit otherwise – the tablet widths below
 * `lg` (four narrow columns) and the desktop widths from `xl` to `2xl` (seven) – the label is at
 * most 84 px wide, with the cell's padding 100 px, so the table fits in every language, and a
 * longer word wraps (hyphenated where the browser knows the page's language, else at any
 * character) instead of widening the table. `w-max` keeps a short label on one line: the cell is
 * as wide as its label up to the limit. In between and from `2xl` on the labels keep their words.
 */
export const NARROW_LABEL_CLASS =
  'max-lg:block max-lg:w-max max-lg:max-w-21 max-lg:hyphens-auto max-lg:wrap-anywhere xl:max-2xl:block xl:max-2xl:w-max xl:max-2xl:max-w-21 xl:max-2xl:hyphens-auto xl:max-2xl:wrap-anywhere';

/**
 * A sort button of a column header, limited like `NARROW_LABEL_CLASS` (its negative margin overlaps
 * the cell's padding, so the column stays at most 100 px wide): the label wraps inside the button,
 * which grows with its lines and keeps its touch target – 44 px, compact on a desktop with a
 * precise pointer (§2.9, `cn` keeps the size's `xl:pointer-fine:h-7`, hence its `h-auto`).
 */
export const SORT_BUTTON_CLASS =
  'h-auto min-h-11 py-1 text-left xl:pointer-fine:h-auto xl:pointer-fine:min-h-7 max-lg:w-max max-lg:max-w-25 max-lg:whitespace-normal max-lg:hyphens-auto max-lg:wrap-anywhere xl:max-2xl:w-max xl:max-2xl:max-w-25 xl:max-2xl:whitespace-normal xl:max-2xl:hyphens-auto xl:max-2xl:wrap-anywhere';

/** Whether one more ticket may be selected (§8.1): at most 100 at once. */
export function canSelectMore(selection: RowSelectionState): boolean {
  return Object.keys(selection).length < MAX_BULK_CHANGE_TICKETS;
}

/** The checkbox of a ticket, disabled once 100 others are selected. */
export function TicketCheckbox({
  table,
  ticket,
  isSelected,
}: {
  table: TicketTable;
  ticket: TicketListItem;
  isSelected: boolean;
}) {
  const t = useTranslations('tickets.list.selection');
  const isDisabled = !isSelected && !canSelectMore(table.state.rowSelection);
  return (
    <Checkbox
      checked={isSelected}
      disabled={isDisabled}
      aria-label={t('selectTicket', { identifier: ticket.identifier })}
      title={isDisabled ? t('limit') : undefined}
      onCheckedChange={(checked) => table.getRow(ticket.id).toggleSelected(checked)}
    />
  );
}

/** The person a ticket names, or the text of its absence. */
function PersonName({ person }: { person: TicketListItem['assignee'] }) {
  const t = useTranslations('tickets');
  if (person === null) {
    return <span className="text-muted-foreground">{t('view.unassigned')}</span>;
  }
  return <>{person.displayName ?? t('deletedUser')}</>;
}

/** The status, the priority and the other fields of a ticket as the list shows them. */
export function useTicketFieldLabels() {
  const t = useTranslations('tickets');
  return useMemo(
    () => ({
      status: (ticket: TicketListItem) => t(`statuses.${ticket.status}`),
      priority: (ticket: TicketListItem) => t(`priorities.${ticket.priority}`),
      type: (ticket: TicketListItem) =>
        ticket.type === null ? t('view.notSet') : t(`types.${ticket.type}`),
    }),
    [t],
  );
}

function UpdatedTime({ ticket }: { ticket: TicketListItem }) {
  const format = useFormatter();
  const now = useNow();
  return (
    <time dateTime={ticket.updatedAt} className="text-muted-foreground">
      {format.relativeTime(new Date(ticket.updatedAt), now)}
    </time>
  );
}

function PriorityBadge({ ticket }: { ticket: TicketListItem }) {
  const labels = useTicketFieldLabels();
  return (
    <Badge
      variant={ticket.priority === 'critical' ? 'destructive' : 'outline'}
      className="h-auto whitespace-normal"
    >
      {labels.priority(ticket)}
    </Badge>
  );
}

function StatusBadge({ ticket }: { ticket: TicketListItem }) {
  const labels = useTicketFieldLabels();
  return (
    <Badge variant="secondary" className="h-auto whitespace-normal">
      {labels.status(ticket)}
    </Badge>
  );
}

export { PersonName, PriorityBadge, StatusBadge, UpdatedTime };

/**
 * The columns of the table (§8.1, S1-13): the selection, identifier, title, status, priority,
 * type, assignee, project, the organization while organizations exist (§7.3) and the last update.
 */
export function useTicketColumns(organizationsExist: boolean) {
  const t = useTranslations('tickets.list');
  const labels = useTicketFieldLabels();
  return useMemo(
    () =>
      helper.columns([
        // The renderings draw the checkbox themselves: it needs the table's selection.
        helper.display({ id: 'select', header: () => t('columns.select'), cell: () => null }),
        helper.accessor('identifier', {
          id: 'identifier',
          header: () => t('columns.identifier'),
          cell: ({ row }) => <span className="font-mono text-sm">{row.original.identifier}</span>,
        }),
        helper.accessor('title', {
          id: 'title',
          header: () => t('columns.title'),
          // Tablets hide the type column, so the title cell shows the type below the title until
          // the desktop width (§8.1). The title column takes the free width and is at least 112 px
          // wide, so the type stays on one line in English and Polish; a longer translation wraps
          // in the cell instead of widening the table (#295).
          cell: ({ row }) => (
            <div className="flex flex-col gap-0.5">
              <Link
                href={ticketHref(row.original)}
                className="line-clamp-2 font-medium hover:underline focus-visible:underline"
              >
                {row.original.title}
              </Link>
              <span className="text-xs wrap-anywhere hyphens-auto text-muted-foreground xl:hidden">
                {labels.type(row.original)}
              </span>
            </div>
          ),
        }),
        helper.accessor('status', {
          id: 'status',
          header: () => t('columns.status'),
          cell: ({ row }) => (
            <span className={NARROW_LABEL_CLASS}>
              <StatusBadge ticket={row.original} />
            </span>
          ),
        }),
        helper.accessor('priority', {
          id: 'priority',
          header: () => t('columns.priority'),
          cell: ({ row }) => (
            <span className={NARROW_LABEL_CLASS}>
              <PriorityBadge ticket={row.original} />
            </span>
          ),
        }),
        helper.accessor('type', {
          id: 'type',
          header: () => t('columns.type'),
          cell: ({ row }) => (
            <span className={NARROW_LABEL_CLASS}>{labels.type(row.original)}</span>
          ),
        }),
        helper.accessor('assignee', {
          id: 'assignee',
          header: () => t('columns.assignee'),
          cell: ({ row }) => (
            <span className={NARROW_LABEL_CLASS}>
              <PersonName person={row.original.assignee} />
            </span>
          ),
        }),
        helper.accessor((ticket) => ticket.project.key, {
          id: 'project',
          header: () => t('columns.project'),
          cell: ({ row }) => (
            <span className={NARROW_LABEL_CLASS}>{row.original.project.name}</span>
          ),
        }),
        ...(organizationsExist
          ? [
              helper.accessor((ticket) => ticket.organization?.name ?? '', {
                id: 'organization',
                header: () => t('columns.organization'),
                cell: ({ row }) => (
                  <span className={NARROW_LABEL_CLASS}>
                    {row.original.organization?.name ?? ''}
                  </span>
                ),
              }),
            ]
          : []),
        helper.accessor('updatedAt', {
          id: 'updated',
          header: () => t('columns.updated'),
          cell: ({ row }) => (
            <span className={NARROW_LABEL_CLASS}>
              <UpdatedTime ticket={row.original} />
            </span>
          ),
        }),
      ]),
    [t, labels, organizationsExist],
  );
}
