import { infiniteQueryOptions, keepPreviousData, queryOptions } from '@tanstack/react-query';
import {
  type Attachment,
  type AttachmentPage,
  MAX_ATTACHMENT_IDS_PER_REQUEST,
} from '@trybun/contracts/attachments';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/** The first and the longest interval of polling an attachment that is being checked (Q7). */
const FIRST_POLL_INTERVAL_MS = 3_000;
const LONGEST_POLL_INTERVAL_MS = 30_000;

/**
 * The polling interval of a list while one of its attachments is in `quarantine` (§18.5, S1-08
 * Q7): one request for the whole list, 3 seconds after the first answer, doubling with every
 * further answer up to 30 seconds; no polling once none is left. S1-15 replaces it with live
 * updates.
 */
export function attachmentPollInterval(
  attachments: readonly Attachment[],
  answers: number,
): number | false {
  if (!attachments.some((attachment) => attachment.status === 'quarantine')) {
    return false;
  }
  return Math.min(FIRST_POLL_INTERVAL_MS * 2 ** Math.max(answers - 1, 0), LONGEST_POLL_INTERVAL_MS);
}

/**
 * The attachments with these IDs the person may read, in chunks of 50 (`GET /api/v1/attachments`,
 * §18.4): the drafts of a form and the images a description references. Unknown and invisible IDs
 * are left out. A changed set of IDs keeps showing the previous answer until the new one arrives.
 */
export function attachmentsQueryOptions(client: ApiClient, ids: readonly string[]) {
  return queryOptions({
    queryKey: ['attachments', 'list', { ids }],
    queryFn: async ({ signal }): Promise<Attachment[]> => {
      const chunks: string[][] = [];
      for (let start = 0; start < ids.length; start += MAX_ATTACHMENT_IDS_PER_REQUEST) {
        chunks.push(ids.slice(start, start + MAX_ATTACHMENT_IDS_PER_REQUEST));
      }
      const pages = await Promise.all(
        chunks.map((chunk) =>
          dataOf(client.GET('/api/v1/attachments', { params: { query: { id: chunk } }, signal })),
        ),
      );
      return pages.flatMap((page) => page.items);
    },
    enabled: ids.length > 0,
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      attachmentPollInterval(query.state.data ?? [], query.state.dataUpdateCount),
  });
}

/** The attachments of a ticket the person may read, oldest first, page by page (§3.2, §18.4). */
export function ticketAttachmentsQueryOptions(client: ApiClient, ticketId: string) {
  return infiniteQueryOptions({
    queryKey: ['attachments', 'list', { ticketId }],
    queryFn: ({ pageParam, signal }): Promise<AttachmentPage> =>
      dataOf(
        client.GET('/api/v1/tickets/{ticketId}/attachments', {
          params: {
            path: { ticketId },
            query: pageParam === null ? {} : { cursor: pageParam },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    refetchInterval: (query) =>
      attachmentPollInterval(
        query.state.data?.pages.flatMap((page) => page.items) ?? [],
        query.state.dataUpdateCount,
      ),
  });
}
