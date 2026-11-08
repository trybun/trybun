import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
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
 * most the one ticket; an invisible ticket is answered like a missing one, with `404` (§5.3).
 */
export function ticketQueryOptions(client: ApiClient, identifier: string) {
  return queryOptions({
    queryKey: ['tickets', 'detail', identifier],
    queryFn: async ({ signal }) => {
      const page = await dataOf(
        client.GET('/api/v1/tickets', { params: { query: { identifier } }, signal }),
      );
      const [ticket] = page.items;
      if (ticket === undefined) {
        throw new ApiError(404, 'request.not_found');
      }
      return ticket;
    },
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 3,
  });
}

/** The activity events of a ticket the person may see, oldest first, page by page (§4.5). */
export function activityEventsQueryOptions(client: ApiClient, ticketId: string) {
  return infiniteQueryOptions({
    queryKey: ['activity-events', 'list', ticketId],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/tickets/{ticketId}/activity-events', {
          params: {
            path: { ticketId },
            query: pageParam === null ? {} : { cursor: pageParam },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
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
