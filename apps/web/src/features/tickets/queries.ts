import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
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
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 3,
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

/** The organizations of the filter: at most this many options. */
const ORGANIZATION_FILTER_LIMIT = 100;

/**
 * The options of the organization filter (S1-13 Q6): the IDs and names of the organizations with
 * access to one of the person's projects, active and archived – archived organizations still
 * appear in snapshots (§7.3).
 */
export function organizationFilterOptionsQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['organizations', 'filter-options'],
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        (['active', 'archived'] as const).map((state) =>
          dataOf(
            client.GET('/api/v1/organizations', {
              params: { query: { state, limit: ORGANIZATION_FILTER_LIMIT } },
              signal,
            }),
          ),
        ),
      );
      return pages
        .flatMap((page) => page.items.map(({ id, name }) => ({ id, label: name })))
        .sort((left, right) => left.label.localeCompare(right.label));
    },
  });
}

/** The members of the projects of the assignee filter (S1-13 Q7), at most this many per project. */
const PROJECT_MEMBER_FILTER_LIMIT = 100;

/**
 * The people of the assignee filter (S1-13 Q7): the members of the chosen projects – also those
 * who can no longer be assigned, so former assignees can still be found.
 */
export function assigneeFilterOptionsQueryOptions(
  client: ApiClient,
  projectIds: readonly string[],
) {
  return queryOptions({
    queryKey: ['projects', 'members', 'filter-options', [...projectIds].sort()],
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        projectIds.map((projectId) =>
          dataOf(
            client.GET('/api/v1/projects/{projectId}/members', {
              params: { path: { projectId }, query: { limit: PROJECT_MEMBER_FILTER_LIMIT } },
              signal,
            }),
          ),
        ),
      );
      const people = new Map<string, string | null>();
      for (const { user } of pages.flatMap((page) => page.items)) {
        people.set(user.id, user.displayName);
      }
      return [...people].map(([id, displayName]) => ({ id, label: displayName }));
    },
    enabled: projectIds.length > 0,
  });
}

/** The projects of the filter: at most this many per state. */
const PROJECT_FILTER_LIMIT = 100;

/** The options of the project filter (§8.1): the person's projects, active and archived. */
export function projectFilterOptionsQueryOptions(client: ApiClient) {
  return queryOptions({
    queryKey: ['projects', 'filter-options'],
    queryFn: async ({ signal }) => {
      const pages = await Promise.all(
        (['active', 'archived'] as const).map((state) =>
          dataOf(
            client.GET('/api/v1/projects', {
              params: { query: { state, limit: PROJECT_FILTER_LIMIT } },
              signal,
            }),
          ),
        ),
      );
      return pages.flatMap((page) =>
        page.items.map(({ id, key, name }) => ({ id, label: `${key} · ${name}` })),
      );
    },
  });
}
