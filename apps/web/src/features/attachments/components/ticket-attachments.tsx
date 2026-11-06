'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Attachment } from '@trybun/contracts/attachments';
import { AttachmentItem, AttachmentList } from '@trybun/ui/components/attachment-list';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { attachmentContentPath } from '@trybun/ui/lib/attachment-path';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { attachmentStateOf } from '../attachment-state.js';
import { useDeleteAttachment } from '../mutations.js';
import { ticketAttachmentsQueryOptions } from '../queries.js';

/**
 * The attachments of a ticket (§3.2, §13.3): name, size, type icon or thumbnail and state, polled
 * while one is being checked (Q7). **Delete** only when the attachment's `allowedActions` contain
 * `delete`, after a confirmation (Q19), because a deleted file cannot be restored. Nothing is
 * shown for a ticket without attachments. The list is prefetched on the server.
 */
export function TicketAttachments({ ticketId }: { ticketId: string }) {
  const t = useTranslations('attachments');
  const errorMessage = useErrorMessage();
  const attachments = useInfiniteQuery(ticketAttachmentsQueryOptions(browserApiClient, ticketId));
  const deleteAttachment = useDeleteAttachment();
  const [pending, setPending] = useState<Attachment | null>(null);
  const items = attachments.data?.pages.flatMap((page) => page.items) ?? [];

  function confirmDelete(attachment: Attachment) {
    deleteAttachment.mutate(attachment, {
      onSuccess: () =>
        toast.add({ title: t('deleted', { name: attachment.fileName }), type: 'success' }),
      onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
      onSettled: () => setPending(null),
    });
  }

  if (attachments.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(attachments.error)}
      </p>
    );
  }
  if (items.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="ticket-attachments" className="flex flex-col gap-2">
      <h2 id="ticket-attachments" className="text-lg font-semibold">
        {t('heading')}
      </h2>
      <AttachmentList>
        {items.map((attachment) => {
          const href = attachmentContentPath(attachment.id);
          return (
            <AttachmentItem
              key={attachment.id}
              fileName={attachment.fileName}
              size={attachment.size}
              contentType={attachment.contentType}
              href={href}
              state={attachmentStateOf(attachment.status)}
              {...(attachment.isImage ? { thumbnailUrl: href } : {})}
              {...(attachment.allowedActions.includes('delete')
                ? { onDelete: () => setPending(attachment) }
                : {})}
            />
          );
        })}
      </AttachmentList>
      {attachments.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={attachments.isFetchingNextPage}
          onClick={() => void attachments.fetchNextPage()}
        >
          {t('loadMore')}
        </Button>
      )}
      {pending !== null && (
        <LazyConfirmDialog
          title={t('deleteTitle', { name: pending.fileName })}
          description={t('deleteDescription')}
          confirmLabel={t('deleteConfirm')}
          cancelLabel={t('cancel')}
          isDestructive
          isPending={deleteAttachment.isPending}
          onConfirm={() => confirmDelete(pending)}
          onClose={() => setPending(null)}
        />
      )}
    </section>
  );
}
