import {
  MAX_TICKET_FILTER_VALUES,
  type SortOrder,
  sortOrderSchema,
  TERMINAL_TICKET_STATUSES,
  type TicketListFilters,
  ticketListFiltersSchema,
  type TicketListSort,
  ticketListSortSchema,
  type TicketStatus,
  ticketStatusSchema,
} from '@trybun/contracts/tickets';
import { z } from 'zod';

/** The open statuses (§4.1): the six non-terminal ones. */
export const OPEN_TICKET_STATUSES: readonly TicketStatus[] = ticketStatusSchema.options.filter(
  (status) => !TERMINAL_TICKET_STATUSES.includes(status),
);

/** The codes of the predefined views of the list (§8.1, S1-13 Q4). */
export const predefinedViewSchema = z.enum([
  'my_open_tickets',
  'triage',
  'critical',
  'unassigned',
  'pending_sharing_approvals',
]);
export type PredefinedView = z.infer<typeof predefinedViewSchema>;

/** A view of the list: a predefined one or the person's own filters (`custom`). */
export type TicketListView = PredefinedView | 'custom';

/** The default view of `/tickets` without parameters (Q9). */
export const DEFAULT_TICKET_LIST_VIEW: PredefinedView = 'my_open_tickets';

/** A sort of the list: the key and the direction. */
export interface TicketListSorting {
  sort: TicketListSort;
  order: SortOrder;
}

/**
 * The predefined views (§8.1, S1-13 Q4, Q20): constants of the application, each a filter set
 * with its default sort. "Me" is resolved by the API.
 */
const PREDEFINED_VIEWS: Readonly<
  Record<PredefinedView, { filters: TicketListFilters; sorting: TicketListSorting }>
> = {
  my_open_tickets: {
    filters: { assigneeId: ['me'], status: [...OPEN_TICKET_STATUSES] },
    sorting: { sort: 'priority', order: 'desc' },
  },
  triage: {
    filters: { status: ['new', 'triage'] },
    sorting: { sort: 'createdAt', order: 'asc' },
  },
  critical: {
    filters: { priority: ['critical'], status: [...OPEN_TICKET_STATUSES] },
    sorting: { sort: 'updatedAt', order: 'desc' },
  },
  unassigned: {
    filters: { assigneeId: ['none'], status: [...OPEN_TICKET_STATUSES] },
    sorting: { sort: 'priority', order: 'desc' },
  },
  pending_sharing_approvals: {
    filters: { sharingRequest: ['pending'] },
    sorting: { sort: 'createdAt', order: 'asc' },
  },
};

/** The default sort of the person's own filters: the order of the Kanban cards (Q8). */
const CUSTOM_SORTING: TicketListSorting = { sort: 'priority', order: 'desc' };

/** The filters of a view; the person's own filters start empty. */
export function filtersOfView(view: TicketListView): TicketListFilters {
  return view === 'custom' ? {} : PREDEFINED_VIEWS[view].filters;
}

/** The default sort of a view (Q20). */
export function defaultSortingOf(view: TicketListView): TicketListSorting {
  return view === 'custom' ? CUSTOM_SORTING : PREDEFINED_VIEWS[view].sorting;
}

/** The filter keys of the list, in the order of the filter bar. */
export const TICKET_LIST_FILTER_KEYS = [
  'projectId',
  'organizationId',
  'type',
  'status',
  'priority',
  'assigneeId',
  'source',
  'sharingRequest',
] as const satisfies readonly (keyof TicketListFilters)[];
export type TicketListFilterKey = (typeof TICKET_LIST_FILTER_KEYS)[number];

/** The state of the list (§18.5 "State"): all of it lives in the URL. */
export interface TicketListState extends TicketListSorting {
  view: TicketListView;
  filters: TicketListFilters;
}

const filterParameterSchemas = ticketListFiltersSchema.shape;

/** Whether a filter parameter of the URL has more values than one filter accepts (§8.1, #291). */
function isOverLimit(raw: unknown): raw is unknown[] {
  return Array.isArray(raw) && raw.length > MAX_TICKET_FILTER_VALUES;
}

/**
 * One filter of the URL; an invalid value drops the filter instead of failing the page. A filter
 * with more values than the limit keeps its first ones (§8.1, #291) – the list says so
 * (`filtersOverLimit`) instead of silently losing the whole filter.
 */
function parseFilter(key: TicketListFilterKey, raw: unknown) {
  if (raw === undefined) {
    return undefined;
  }
  const values = isOverLimit(raw) ? raw.slice(0, MAX_TICKET_FILTER_VALUES) : raw;
  return filterParameterSchemas[key].safeParse(values).data;
}

/**
 * The filters of the URL that had more values than one filter accepts and kept only their first
 * ones (§8.1, #291), in the order of the filter bar; a predefined view ignores filter parameters.
 */
export function filtersOverLimit(
  params: Readonly<Record<string, string | string[] | undefined>>,
): TicketListFilterKey[] {
  if (predefinedViewSchema.safeParse(params.view).success) {
    return [];
  }
  return TICKET_LIST_FILTER_KEYS.filter(
    (key) => isOverLimit(params[key]) && parseFilter(key, params[key]) !== undefined,
  );
}

/**
 * The state of the list from the search parameters of `/tickets` (S1-13): `?view=<code>` is a
 * predefined view with its filters; explicit filter parameters are the person's own filters; a
 * custom filter without values is `?view=custom`; nothing opens the default view (Q9). `sort` and
 * `order` are written only when they differ from the view's default.
 */
export function parseTicketListSearchParams(
  params: Readonly<Record<string, string | string[] | undefined>>,
): TicketListState {
  const filters: TicketListFilters = {};
  for (const key of TICKET_LIST_FILTER_KEYS) {
    const value = parseFilter(key, params[key]);
    if (value !== undefined) {
      Object.assign(filters, { [key]: value });
    }
  }
  const named = predefinedViewSchema.safeParse(params.view).data;
  const view: TicketListView =
    named ??
    (Object.keys(filters).length > 0 || params.view === 'custom'
      ? 'custom'
      : DEFAULT_TICKET_LIST_VIEW);
  const defaults = defaultSortingOf(view);
  const sort = ticketListSortSchema.safeParse(params.sort).data;
  const order = sortOrderSchema.safeParse(params.order).data;
  return {
    view,
    filters: view === 'custom' ? filters : filtersOfView(view),
    sort: sort ?? defaults.sort,
    order: sort === undefined ? defaults.order : (order ?? 'desc'),
  };
}

/** The address of a state of the list, the inverse of `parseTicketListSearchParams`. */
export function ticketListHref(state: TicketListState): string {
  const params = new URLSearchParams();
  if (state.view === 'custom') {
    for (const key of TICKET_LIST_FILTER_KEYS) {
      for (const value of state.filters[key] ?? []) {
        params.append(key, value);
      }
    }
    if (params.size === 0) {
      params.set('view', 'custom');
    }
  } else {
    params.set('view', state.view);
  }
  const defaults = defaultSortingOf(state.view);
  if (state.sort !== defaults.sort || state.order !== defaults.order) {
    params.set('sort', state.sort);
    params.set('order', state.order);
  }
  return `/tickets?${params.toString()}`;
}

/** The state after a change of the filters: the person's own filters, with the same sort. */
export function withFilters(state: TicketListState, filters: TicketListFilters): TicketListState {
  const isDefaultSorting =
    state.sort === defaultSortingOf(state.view).sort &&
    state.order === defaultSortingOf(state.view).order;
  return {
    view: 'custom',
    filters,
    ...(isDefaultSorting ? defaultSortingOf('custom') : { sort: state.sort, order: state.order }),
  };
}

/** The filters with the values of one filter replaced; a filter without values is removed. */
export function withFilterValues(
  filters: TicketListFilters,
  key: TicketListFilterKey,
  values: readonly string[],
): TicketListFilters {
  const rest = Object.fromEntries(
    Object.entries(filters).filter(([current]) => current !== key),
  ) as TicketListFilters;
  return values.length === 0 ? rest : { ...rest, [key]: [...values] };
}

/** The state of a predefined view, or of empty own filters, with its default sort. */
export function stateOfView(view: TicketListView): TicketListState {
  return { view, filters: filtersOfView(view), ...defaultSortingOf(view) };
}

/** The largest number of tickets one bulk action changes (§8.1). */
export { MAX_BULK_CHANGE_TICKETS } from '@trybun/contracts/tickets';
