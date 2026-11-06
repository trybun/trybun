'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Attachment } from '@trybun/contracts/attachments';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';

/**
 * Uploads one file as a draft attachment (§13.3, S1-08 Q6): one request per file, so every file
 * succeeds or fails on its own. The draft is in `quarantine` until the malware scan has finished.
 */
export function useUploadAttachment() {
  return useMutation({
    mutationFn: async (file: File): Promise<Attachment> => {
      const page = await dataOf(
        browserApiClient.POST('/api/v1/attachments', {
          // The generated type describes the multipart field; the serializer sends the file itself,
          // and the browser sets the content type with its boundary.
          body: { files: [] },
          bodySerializer: () => {
            const form = new FormData();
            form.append('files', file);
            return form;
          },
        }),
      );
      const [attachment] = page.items;
      if (attachment === undefined) {
        throw new Error('The upload answered without its attachment');
      }
      return attachment;
    },
  });
}

/**
 * Deletes an attachment (§13.3): a draft of the person, or an attachment of a ticket when its
 * `allowedActions` contain `delete`. The lists of attachments are read again, and the timeline of
 * the ticket, which records the deletion.
 */
export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachment: Pick<Attachment, 'id' | 'ticketId'>) =>
      dataOf(
        browserApiClient.DELETE('/api/v1/attachments/{attachmentId}', {
          params: { path: { attachmentId: attachment.id } },
        }),
      ),
    onSettled: (_data, _error, attachment) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ['attachments'] }),
        attachment.ticketId === null
          ? undefined
          : queryClient.invalidateQueries({
              queryKey: ['activity-events', 'list', attachment.ticketId],
            }),
      ]),
  });
}

/**
 * Attaches the person's drafts to an existing ticket (§3.2, S1-08 Q4). The ticket's list starts
 * polling again from its first interval (Q7), and its timeline records the added files.
 */
export function useAddTicketAttachments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ticketId, attachmentIds }: { ticketId: string; attachmentIds: string[] }) =>
      dataOf(
        browserApiClient.POST('/api/v1/tickets/{ticketId}/attachments', {
          params: { path: { ticketId } },
          body: { attachmentIds },
        }),
      ),
    onSettled: (_data, _error, { ticketId }) =>
      Promise.all([
        queryClient.resetQueries({ queryKey: ['attachments', 'list', { ticketId }] }),
        queryClient.invalidateQueries({ queryKey: ['activity-events', 'list', ticketId] }),
      ]),
  });
}
