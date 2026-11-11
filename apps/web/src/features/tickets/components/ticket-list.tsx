'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useTable } from '@tanstack/react-table';
import type {
  BulkChangeResult,
  BulkTicketChange,
  TicketListFilters,
  TicketListItem,
  TicketListItemResponse,
} from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { Tabs, TabsList, TabsTrigger } from '@trybun/ui/components/tabs';
import { toast } from '@trybun/ui/components/toast';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { useMemo, useOptimistic, useState, useTransition } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { type TicketVersion, useBulkChangeTickets } from '../mutations.js';
import { ticketListInfiniteQueryOptions } from '../queries.js';
import {
  predefinedViewSchema,
  stateOfView,
  type TicketListSorting,
  type TicketListState,
  type TicketListView,
  ticketListHref,
  withFilters,
} from '../ticket-list.js';
import type { UnchangedTicket } from './bulk-change-result-dialog.js';
import { LazyBulkChangeResultDialog } from './lazy-bulk-dialogs.js';
import { LazyRefuseSharingDialog, LazyShareDialog } from './lazy-sharing-dialogs.js';
import { TicketBulkActionBar } from './ticket-bulk-action-bar.js';
import { TicketCardList } from './ticket-card-list.js';
import { TicketFilterBar, TicketSortSelect } from './ticket-filter-bar.js';
import {
  SORT_OF_COLUMN,
  TICKET_TABLE_FEATURES,
  ticketHref,
  useTicketColumns,
} from './ticket-list-columns.js';
import { TicketTable } from './ticket-table.js';

const VIEWS: readonly TicketListView[] = [...predefinedViewSchema.options, 'custom'];

/** A list item of a team account: the team's shape (§3.2). */
function isTeamItem(item: TicketListItemResponse): item is TicketListItem {
  return 'status' in item;
}

const NO_ITEMS: TicketListItem[] = [];

/** The open result dialog of a bulk change. */
interface BulkOutcome {
  change: BulkTicketChange;
  changed: number;
  total: number;
  unchanged: UnchangedTicket[];
  left: number;
}

/**
 * The view picker (§8.1): the predefined views as tabs from the tablet width on, a select on
 * phones. After a filter change no predefined view is marked ("Custom filter").
 */
function TicketViewPicker({
  view,
  onViewChange,
}: {
  view: TicketListView;
  onViewChange: (view: TicketListView) => void;
}) {
  const t = useTranslations('tickets.list.views');
  const items = VIEWS.map((value) => ({ value, label: t(value) }));
  const choose = (next: unknown) => {
    const value = VIEWS.find((candidate) => candidate === next);
    if (value !== undefined && value !== view) {
      onViewChange(value);
    }
  };
  return (
    <>
      <div className="md:hidden">
        <Select items={items} value={view} onValueChange={choose}>
          <SelectTrigger aria-label={t('label')} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Tabs value={view} onValueChange={choose} className="hidden md:flex">
        <TabsList aria-label={t('label')} className="flex-wrap">
          {VIEWS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(value)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </>
  );
}

/**
 * A sharing action shrinks and wraps its label between words – within a word only when one word
 * is wider than the title cell – so in every language it stays inside the cell instead of drawing
 * over the Status column (#296); a `Button` does not shrink by default.
 */
const SHARING_ACTION_CLASS =
  'h-auto min-h-11 shrink whitespace-normal wrap-anywhere xl:pointer-fine:min-h-7';

/** The actions on a pending sharing request (S1-13 Q11), by its `allowedActions`. */
function SharingActions({ ticket }: { ticket: TicketListItem }) {
  const t = useTranslations('tickets.list.sharing');
  const [dialog, setDialog] = useState<'approve' | 'refuse' | null>(null);
  const version: TicketVersion = ticket;
  return (
    <div className="flex flex-wrap gap-2">
      {ticket.allowedActions.includes('approve_sharing') && (
        <Button
          type="button"
          size="sm"
          className={SHARING_ACTION_CLASS}
          onClick={() => setDialog('approve')}
        >
          {t('approve')}
        </Button>
      )}
      {ticket.allowedActions.includes('reject_sharing') && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={SHARING_ACTION_CLASS}
          onClick={() => setDialog('refuse')}
        >
          {t('refuse')}
        </Button>
      )}
      {dialog === 'approve' && (
        <LazyShareDialog
          ticket={version}
          approve
          viewHref={ticketHref(ticket)}
          onDone={() => {
            setDialog(null);
            toast.add({ title: t('approved', { identifier: ticket.identifier }), type: 'success' });
          }}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'refuse' && (
        <LazyRefuseSharingDialog
          ticket={version}
          onDone={() => {
            setDialog(null);
            toast.add({ title: t('refused', { identifier: ticket.identifier }), type: 'success' });
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

/** The tickets of the list's state, page by page (§18.4). */
function useTicketListQuery(state: TicketListState) {
  // A filter applies at once (#279): while the next page loads, the rows of the last one stay.
  return useInfiniteQuery({
    ...ticketListInfiniteQueryOptions(browserApiClient, state),
    placeholderData: keepPreviousData,
  });
}

type TicketListQuery = ReturnType<typeof useTicketListQuery>;

/**
 * The team's ticket list (§8.1, S1-13): the view picker, the filter bar and the tickets. The
 * filter bar stays mounted across a change of the address, so an open picker stays open while its
 * changes apply (#279); the tickets render anew for every address, which clears the selection
 * (Q17). All state but the selection lives in the URL (§18.5).
 */
export function TicketList({
  state,
  currentUserId,
  organizationsExist,
}: {
  state: TicketListState;
  currentUserId: string;
  organizationsExist: boolean;
}) {
  const router = useRouter();
  const go = (next: TicketListState) => router.replace(ticketListHref(next), { scroll: false });
  const tickets = useTicketListQuery(state);
  // The chips and the pickers show a change at once, before the server renders the new address.
  const [, startTransition] = useTransition();
  const [filters, setOptimisticFilters] = useOptimistic(state.filters);
  const sorting: TicketListSorting = { sort: state.sort, order: state.order };

  return (
    <div className="flex flex-col gap-4 pb-40 md:pb-0">
      <TicketViewPicker view={state.view} onViewChange={(view) => go(stateOfView(view))} />
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <TicketFilterBar
          filters={filters}
          organizationsExist={organizationsExist}
          onFiltersChange={(next: TicketListFilters) =>
            startTransition(() => {
              setOptimisticFilters(next);
              go(withFilters(state, next));
            })
          }
        />
        <TicketSortSelect sorting={sorting} onSortingChange={(next) => go({ ...state, ...next })} />
      </div>
      <TicketResults
        key={ticketListHref(state)}
        state={state}
        tickets={tickets}
        currentUserId={currentUserId}
        organizationsExist={organizationsExist}
        onStateChange={go}
      />
    </div>
  );
}

/**
 * The tickets of the list: as a table from the tablet width on and as cards on phones – both from
 * one TanStack Table row model and selection (Q14), switched by CSS so the server's HTML is right
 * on every device – **Show more** (Q19), and the bulk actions with their results (Q1, Q17).
 */
function TicketResults({
  state,
  tickets,
  currentUserId,
  organizationsExist,
  onStateChange: go,
}: {
  state: TicketListState;
  tickets: TicketListQuery;
  currentUserId: string;
  organizationsExist: boolean;
  onStateChange: (state: TicketListState) => void;
}) {
  const t = useTranslations('tickets.list');
  const errorMessage = useErrorMessage();
  const items = useMemo(
    () => tickets.data?.pages.flatMap((page) => page.items).filter(isTeamItem) ?? NO_ITEMS,
    [tickets.data],
  );
  const columns = useTicketColumns(organizationsExist);
  const table = useTable({
    features: TICKET_TABLE_FEATURES,
    columns,
    data: items,
    getRowId: (ticket) => ticket.id,
  });
  const bulkChange = useBulkChangeTickets();
  const [outcome, setOutcome] = useState<BulkOutcome | null>(null);

  // A selected ticket that left the list (after a refetch) is no longer selected (Q17).
  const selected = items.filter((ticket) => table.state.rowSelection[ticket.id] === true);
  const sorting: TicketListSorting = { sort: state.sort, order: state.order };

  const run = async (change: BulkTicketChange, targets: TicketListItem[], left = 0) => {
    let results: BulkChangeResult[];
    try {
      ({ results } = await bulkChange.mutateAsync({ tickets: targets, change }));
    } catch (error) {
      toast.add({ title: errorMessage(error), type: 'error' });
      return;
    }
    const byId = new Map(targets.map((ticket) => [ticket.id, ticket]));
    const unchanged = results.flatMap((result) => {
      const ticket = byId.get(result.id);
      return result.status === 200 || ticket === undefined ? [] : [{ ticket, result }];
    });
    const changed = results.length - unchanged.length;
    // Tickets that were not changed stay selected for Reload and retry (Q17).
    table.setRowSelection(Object.fromEntries(unchanged.map(({ ticket }) => [ticket.id, true])));
    if (unchanged.length === 0 && left === 0) {
      setOutcome(null);
      const waiting = results.filter(
        (result) =>
          result.status === 200 &&
          change.field === 'status' &&
          change.status !== 'waiting_for_requester' &&
          'status' in result.ticket &&
          result.ticket.status === 'waiting_for_requester',
      ).length;
      toast.add({
        title: t('bulk.updated', { count: changed }),
        description: waiting > 0 ? t('bulk.waiting', { count: waiting }) : undefined,
        type: 'success',
      });
      return;
    }
    setOutcome({ change, changed, total: results.length, unchanged, left });
  };

  const retry = async () => {
    if (outcome === null) {
      return;
    }
    const refetched = await tickets.refetch();
    const current = new Map(
      (refetched.data?.pages.flatMap((page) => page.items).filter(isTeamItem) ?? []).map(
        (ticket) => [ticket.id, ticket],
      ),
    );
    const targets = outcome.unchanged.flatMap(({ ticket }) => {
      const fresh = current.get(ticket.id);
      return fresh === undefined ? [] : [fresh];
    });
    const left = outcome.unchanged.length - targets.length;
    if (targets.length === 0) {
      table.setRowSelection({});
      setOutcome({ ...outcome, changed: 0, total: 0, unchanged: [], left });
      return;
    }
    await run(outcome.change, targets, left);
  };

  const onSort = (columnId: string) => {
    const sort = SORT_OF_COLUMN[columnId];
    if (sort !== undefined) {
      go({
        ...state,
        sort,
        order: state.sort === sort && state.order === 'desc' ? 'asc' : 'desc',
      });
    }
  };
  const rowActions =
    state.view === 'pending_sharing_approvals'
      ? (ticket: TicketListItem) => <SharingActions ticket={ticket} />
      : undefined;

  return (
    <div className="flex flex-col gap-4" aria-busy={tickets.isPlaceholderData}>
      {selected.length > 0 && (
        <TicketBulkActionBar
          selected={selected}
          currentUserId={currentUserId}
          isPending={bulkChange.isPending}
          onChange={(change) => void run(change, selected)}
          onClear={() => table.resetRowSelection()}
        />
      )}
      {tickets.isError && (
        <p role="alert" className="text-sm text-destructive">
          {t('loadFailed')}
        </p>
      )}
      {!tickets.isSuccess ? null : items.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-muted-foreground">{t(`empty.${state.view}`)}</p>
          {state.view === 'custom' && Object.keys(state.filters).length > 0 && (
            <Button type="button" variant="link" onClick={() => go(withFilters(state, {}))}>
              {t('filters.clear')}
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="md:hidden">
            <TicketCardList table={table} rowActions={rowActions} />
          </div>
          <div className="hidden md:block">
            <TicketTable table={table} sorting={sorting} onSort={onSort} rowActions={rowActions} />
          </div>
        </>
      )}
      {tickets.hasNextPage && (
        <Button
          type="button"
          variant="outline"
          className="self-center"
          disabled={tickets.isFetchingNextPage}
          onClick={() => void tickets.fetchNextPage()}
        >
          {tickets.isFetchingNextPage ? t('loadingMore') : t('showMore')}
        </Button>
      )}
      {outcome !== null && (
        <LazyBulkChangeResultDialog
          changed={outcome.changed}
          total={outcome.total}
          unchanged={outcome.unchanged}
          left={outcome.left}
          isRetrying={bulkChange.isPending || tickets.isRefetching}
          onRetry={() => void retry()}
          onClose={() => setOutcome(null)}
        />
      )}
    </div>
  );
}
