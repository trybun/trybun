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
 * the desktop width on.
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
          cell: ({ row }) => (
            <Link
              href={ticketHref(row.original)}
              className="line-clamp-2 font-medium hover:underline focus-visible:underline"
            >
              {row.original.title}
            </Link>
          ),
        }),
        helper.accessor('status', {
          id: 'status',
          header: () => t('columns.status'),
          cell: ({ row }) => <StatusBadge ticket={row.original} />,
        }),
        helper.accessor('priority', {
          id: 'priority',
          header: () => t('columns.priority'),
          cell: ({ row }) => <PriorityBadge ticket={row.original} />,
        }),
        helper.accessor('type', {
          id: 'type',
          header: () => t('columns.type'),
          cell: ({ row }) => labels.type(row.original),
        }),
        helper.accessor('assignee', {
          id: 'assignee',
          header: () => t('columns.assignee'),
          cell: ({ row }) => <PersonName person={row.original.assignee} />,
        }),
        helper.accessor((ticket) => ticket.project.key, {
          id: 'project',
          header: () => t('columns.project'),
          cell: ({ row }) => row.original.project.name,
        }),
        ...(organizationsExist
          ? [
              helper.accessor((ticket) => ticket.organization?.name ?? '', {
                id: 'organization',
                header: () => t('columns.organization'),
                cell: ({ row }) => row.original.organization?.name ?? '',
              }),
            ]
          : []),
        helper.accessor('updatedAt', {
          id: 'updated',
          header: () => t('columns.updated'),
          cell: ({ row }) => <UpdatedTime ticket={row.original} />,
        }),
      ]),
    [t, labels, organizationsExist],
  );
}
