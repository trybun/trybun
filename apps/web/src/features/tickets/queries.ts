import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { MAX_TICKET_FILTER_VALUES } from '@trybun/contracts/pagination';
import type { SortOrder, TicketListFilters, TicketListSort } from '@trybun/contracts/tickets';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';

/**
 * "My tickets" (§5.7, Q10): the tickets the person requested – those awaiting their reply first,
 * then the most recently updated – across projects or of one project, page by page (§18.4).
 */
export function myTicketsQueryOptions(
  client: ApiClient,
  { projectId, limit }: { projectId?: string; limit?: number } = {},
) {
  return infiniteQueryOptions({
    queryKey: ['tickets', 'list', { involvement: 'mine', projectId, limit }],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/tickets', {
          params: {
            query: {
              involvement: 'mine',
              ...(projectId === undefined ? {} : { projectId }),
              ...(limit === undefined ? {} : { limit }),
              ...(pageParam === null ? {} : { cursor: pageParam }),
            },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** Whether a failed read is tried again: a refusal (`4xx`, also `429`) never is, as it would repeat. */
function retryUnlessRefused(failureCount: number, error: Error) {
  return !(error instanceof ApiError && error.status < 500) && failureCount < 3;
}

/**
 * A ticket by its identifier such as `ERP-12` (§3.2, S1-05 Q12): the identifier lookup returns at
 * most the one ticket; an invisible ticket is answered like a missing one, with `404` (§5.3). A
 * list item has no description (S1-13 Q10), so the detail is read by the ID the lookup found.
 */
export function ticketQueryOptions(client: ApiClient, identifier: string) {
  return queryOptions({
    queryKey: ['tickets', 'detail', identifier],
    queryFn: async ({ signal }) => {
      const page = await dataOf(
        client.GET('/api/v1/tickets', { params: { query: { identifier } }, signal }),
      );
      const [item] = page.items;
      if (item === undefined) {
        throw new ApiError(404, 'request.not_found');
      }
      return dataOf(
        client.GET('/api/v1/tickets/{ticketId}', {
          params: { path: { ticketId: item.id } },
          signal,
        }),
      );
    },
    retry: retryUnlessRefused,
  });
}

/** How many people the assignee picker shows for one search. */
const ASSIGNABLE_MEMBERS_LIMIT = 50;

/**
 * The people who can be assigned to the tickets of a project (S1-10 Q9), searched on the server by
 * display name and GitHub login: the API applies the eligibility rule, never the web application.
 * The key lies under the project's members, so a change of the members refreshes it.
 */
export function assignableMembersQueryOptions(
  client: ApiClient,
  projectId: string,
  search: string,
) {
  return queryOptions({
    queryKey: ['projects', 'members', projectId, { assignable: true, query: search }],
    queryFn: ({ signal }) =>
      dataOf(
        client.GET('/api/v1/projects/{projectId}/members', {
          params: {
            path: { projectId },
            query: {
              assignable: 'true',
              limit: ASSIGNABLE_MEMBERS_LIMIT,
              ...(search === '' ? {} : { query: search }),
            },
          },
          signal,
        }),
      ),
  });
}

/**
 * The ticket of a project with an identifier such as `ERP-7` (§3.2), or `null`: the original a
 * duplicate is marked with, resolved before it is confirmed (S1-10). Another project's ticket is
 * not found, as an invisible one.
 */
export function projectTicketQueryOptions(
  client: ApiClient,
  projectId: string,
  identifier: string,
) {
  return queryOptions({
    queryKey: ['tickets', 'list', { projectId, identifier }],
    queryFn: async ({ signal }) => {
      const page = await dataOf(
        client.GET('/api/v1/tickets', { params: { query: { projectId, identifier } }, signal }),
      );
      return page.items[0] ?? null;
    },
  });
}

/** The tickets of one page of the list (§18.4, S1-13 Q19). */
const TICKET_LIST_PAGE_SIZE = 50;

/**
 * The team's ticket list (§8.1, S1-13): the tickets of the filters in the sort, page by page with
 * **Show more**. Every server-owned part of the request is in the key (§18.5).
 */
export function ticketListInfiniteQueryOptions(
  client: ApiClient,
  { filters, sort, order }: { filters: TicketListFilters; sort: TicketListSort; order: SortOrder },
) {
  return infiniteQueryOptions({
    queryKey: ['tickets', 'list', { filters, sort, order }],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/tickets', {
          params: {
            query: {
              ...filters,
              sort,
              order,
              limit: TICKET_LIST_PAGE_SIZE,
              ...(pageParam === null ? {} : { cursor: pageParam }),
            },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** How many options one search of a filter picker shows, per state of a list (§8.1, #279). */
export const FILTER_SEARCH_LIMIT = 50;

/**
 * A record a filter can choose: its ID, its label (`null` for a deleted user) and, for a project,
 * its key, which its chip shows.
 */
export interface FilterRecord {
  id: string;
  label: string | null;
  short?: string;
}

/** One search of a filter picker: the first page, and whether typing would find more. */
export interface FilterSearchPage {
  records: FilterRecord[];
  hasMore: boolean;
}

/** The records of a filter, each once: the active and the archived list may share one. */
function uniqueById(records: FilterRecord[]): FilterRecord[] {
  return [...new Map(records.map((record) => [record.id, record])).values()];
}

/** The search parameter of a list: a blank search is no search. */
function searchQuery(search: string) {
  const query = search.trim();
  return query === '' ? {} : { query };
}

/** One page of each state of a list, the active records first, then the archived ones (§7.3). */
async function bothStates<Item>(
  read: (state: 'active' | 'archived') => Promise<{ items: Item[]; nextCursor: string | null }>,
  toRecord: (item: Item) => FilterRecord,
): Promise<FilterSearchPage> {
  const pages = await Promise.all((['active', 'archived'] as const).map(read));
  return {
    records: uniqueById(pages.flatMap((page) => page.items.map(toRecord))),
    hasMore: pages.some((page) => page.nextCursor !== null),
  };
}

const projectRecord = ({ id, key, name }: { id: string; key: string; name: string }) => ({
  id,
  label: `${key} · ${name}`,
  short: key,
});

const organizationRecord = ({ id, name }: { id: string; name: string }) => ({ id, label: name });

const personRecord = ({
  id,
  displayName,
  githubLogin,
}: {
  id: string;
  displayName: string | null;
  githubLogin: string | null;
}) => ({ id, label: displayName ?? (githubLogin === null ? null : `@${githubLogin}`) });

/**
 * The projects of the project filter's picker (§8.1, #279): searched on the server by key and
 * name, the first page of the active and of the archived projects – archived ones still have
 * tickets. Typing narrows the list; the picker never reads further pages.
 */
export function projectFilterSearchQueryOptions(client: ApiClient, search: string) {
  return queryOptions({
    queryKey: ['projects', 'filter-search', { query: search.trim() }],
    queryFn: ({ signal }) =>
      bothStates(
        (state) =>
          dataOf(
            client.GET('/api/v1/projects', {
              params: { query: { state, limit: FILTER_SEARCH_LIMIT, ...searchQuery(search) } },
              signal,
            }),
          ),
        projectRecord,
      ),
    retry: retryUnlessRefused,
  });
}

/**
 * The organizations of the organization filter's picker (S1-13 Q6, #279): those with access to
 * one of the person's projects, searched on the server by name, active and archived (§7.3).
 */
export function organizationFilterSearchQueryOptions(client: ApiClient, search: string) {
  return queryOptions({
    queryKey: ['organizations', 'filter-search', { query: search.trim() }],
    queryFn: ({ signal }) =>
      bothStates(
        (state) =>
          dataOf(
            client.GET('/api/v1/organizations', {
              params: { query: { state, limit: FILTER_SEARCH_LIMIT, ...searchQuery(search) } },
              signal,
            }),
          ),
        organizationRecord,
      ),
    retry: retryUnlessRefused,
  });
}

/**
 * The people of the assignee filter's picker (S1-13 Q7, #279): the team members of the chosen
 * projects in one request, searched on the server by display name and GitHub login – also those
 * who can no longer be assigned, so former assignees can be found. Without projects there is
 * nobody to offer.
 */
export function assigneeFilterSearchQueryOptions(
  client: ApiClient,
  projectIds: readonly string[],
  search: string,
) {
  return queryOptions({
    queryKey: [
      'projects',
      'members',
      'filter-search',
      { projectId: [...projectIds].sort(), query: search.trim() },
    ],
    queryFn: async ({ signal }): Promise<FilterSearchPage> => {
      const page = await dataOf(
        client.GET('/api/v1/project-members', {
          params: {
            query: {
              projectId: [...projectIds],
              limit: FILTER_SEARCH_LIMIT,
              ...searchQuery(search),
            },
          },
          signal,
        }),
      );
      return { records: page.items.map(personRecord), hasMore: page.nextCursor !== null };
    },
    enabled: projectIds.length > 0,
    retry: retryUnlessRefused,
  });
}

/**
 * The projects of chosen IDs, for the chips and the pinned rows of the project filter (#279):
 * looked up by ID in both states. An ID the person cannot see is simply absent – its chip says
 * "Unknown" (S1-13 Q5).
 */
export function projectFilterNamesQueryOptions(client: ApiClient, ids: readonly string[]) {
  return queryOptions({
    queryKey: ['projects', 'filter-names', [...ids].sort()],
    queryFn: async ({ signal }) =>
      (
        await bothStates(
          (state) =>
            dataOf(
              client.GET('/api/v1/projects', {
                params: { query: { state, id: [...ids], limit: MAX_TICKET_FILTER_VALUES } },
                signal,
              }),
            ),
          projectRecord,
        )
      ).records,
    enabled: ids.length > 0,
    retry: retryUnlessRefused,
  });
}

/** The organizations of chosen IDs, for the chips and the pinned rows (#279). */
export function organizationFilterNamesQueryOptions(client: ApiClient, ids: readonly string[]) {
  return queryOptions({
    queryKey: ['organizations', 'filter-names', [...ids].sort()],
    queryFn: async ({ signal }) =>
      (
        await bothStates(
          (state) =>
            dataOf(
              client.GET('/api/v1/organizations', {
                params: { query: { state, id: [...ids], limit: MAX_TICKET_FILTER_VALUES } },
                signal,
              }),
            ),
          organizationRecord,
        )
      ).records,
    enabled: ids.length > 0,
    retry: retryUnlessRefused,
  });
}

/**
 * The people of chosen IDs, for the chips and the pinned rows of the assignee filter (#279): among
 * the members of every project whose members the person may read, so a shared link with only an
 * assignee still names them.
 */
export function assigneeFilterNamesQueryOptions(client: ApiClient, ids: readonly string[]) {
  return queryOptions({
    queryKey: ['projects', 'members', 'filter-names', [...ids].sort()],
    queryFn: async ({ signal }) => {
      const page = await dataOf(
        client.GET('/api/v1/project-members', {
          params: { query: { userId: [...ids], limit: MAX_TICKET_FILTER_VALUES } },
          signal,
        }),
      );
      return page.items.map(personRecord);
    },
    enabled: ids.length > 0,
    retry: retryUnlessRefused,
  });
}
