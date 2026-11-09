import { infiniteQueryOptions } from '@tanstack/react-query';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/**
 * The timeline of a ticket the person may see (S1-12 Q11): its comments and activity events in
 * one list, oldest first, page by page (§18.4). With **Hide events** on, the API returns only the
 * comments (§4.5).
 */
export function timelineQueryOptions(client: ApiClient, ticketId: string) {
  return infiniteQueryOptions({
    queryKey: ['comments', 'timeline', ticketId],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/tickets/{ticketId}/timeline', {
          params: { path: { ticketId }, query: pageParam === null ? {} : { cursor: pageParam } },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** The earlier versions of a comment, newest first (§6.1, S1-12 Q3). */
export function commentRevisionsQueryOptions(client: ApiClient, commentId: string) {
  return infiniteQueryOptions({
    queryKey: ['comments', 'revisions', commentId],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/comments/{commentId}/revisions', {
          params: { path: { commentId }, query: pageParam === null ? {} : { cursor: pageParam } },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** The earlier versions of a ticket's description, newest first (§6.1, S1-12 Q3). */
export function descriptionRevisionsQueryOptions(client: ApiClient, ticketId: string) {
  return infiniteQueryOptions({
    queryKey: ['comments', 'description-revisions', ticketId],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/tickets/{ticketId}/description-revisions', {
          params: { path: { ticketId }, query: pageParam === null ? {} : { cursor: pageParam } },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
