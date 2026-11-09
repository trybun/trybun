'use client';

import { useQuery } from '@tanstack/react-query';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { referencedAttachmentIds, ticketImageIdsOf } from './markdown-references.js';
import { attachmentsQueryOptions } from './queries.js';

/**
 * The images a ticket's Markdown shows inline (§13.3): the attachments it references, looked up by
 * their IDs independent of the pages of the attachment list, and kept when they are available
 * images of the same ticket. Polled while one of them is being checked (Q7).
 */
export function useTicketImageIds(ticketId: string, markdown: string): string[] {
  const attachments = useQuery(
    attachmentsQueryOptions(browserApiClient, referencedAttachmentIds(markdown)),
  );
  return ticketImageIdsOf(attachments.data ?? [], ticketId);
}
