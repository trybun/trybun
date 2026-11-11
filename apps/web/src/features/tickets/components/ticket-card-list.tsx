'use client';

import type { TicketListItem } from '@trybun/contracts/tickets';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  PersonName,
  PriorityBadge,
  StatusBadge,
  TicketCheckbox,
  type TicketTable,
  ticketHref,
  useTicketFieldLabels,
} from './ticket-list-columns.js';

/**
 * The list as cards on phones (§2.9, S1-13 Q14): one card per row of the same row model and
 * selection as the table, with the identifier and the type ("Not set" without one) on one line,
 * the title (two lines at most), the status, the priority, the assignee and a 44 px checkbox –
 * always visible, never a long press (Rule 9). The separator is hidden from assistive technology,
 * so the link's name is the identifier, the type and the title (§8.1).
 */
export function TicketCardList({
  table,
  rowActions,
}: {
  table: TicketTable;
  rowActions?: (ticket: TicketListItem) => ReactNode;
}) {
  const labels = useTicketFieldLabels();
  return (
    <ul className="flex flex-col gap-2">
      {table.getRowModel().rows.map((row) => {
        const ticket = row.original;
        const isSelected = row.getIsSelected();
        return (
          <li
            key={row.id}
            data-state={isSelected ? 'selected' : undefined}
            className={cn(
              'flex gap-1 rounded-lg border border-border bg-card p-2 text-card-foreground',
              isSelected && 'bg-muted',
            )}
          >
            <span className="flex size-11 shrink-0 items-center justify-center">
              <TicketCheckbox table={table} ticket={ticket} isSelected={isSelected} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
              <Link href={ticketHref(ticket)} className="flex min-h-11 flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">
                  <span className="font-mono">{ticket.identifier}</span>{' '}
                  <span aria-hidden="true">·</span> <span>{labels.type(ticket)}</span>
                </span>{' '}
                {/* The space separates the type and the title in the link's name; a flex
                    container does not render it. */}
                <span className="line-clamp-2 font-medium">{ticket.title}</span>
              </Link>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <StatusBadge ticket={ticket} />
                <PriorityBadge ticket={ticket} />
                <span className="truncate">
                  <PersonName person={ticket.assignee} />
                </span>
              </div>
              {rowActions?.(ticket)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
