'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { Button } from '@trybun/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@trybun/ui/components/dialog';
import { Markdown, type MarkdownProps } from '@trybun/ui/components/markdown';
import { useFormatter, useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { commentRevisionsQueryOptions, descriptionRevisionsQueryOptions } from '../queries.js';

/** The text whose history is shown: a comment or a ticket's description. */
export type RevisedText = { commentId: string } | { ticketId: string };

/**
 * The edit history of a text (§6.1, S1-12 Q3): its earlier versions, newest first, each with the
 * person who wrote it and when, rendered as Markdown. A bottom sheet on phones (§18.6).
 */
export function RevisionsDialog({
  text,
  mentions,
  imageIds,
  onClose,
}: {
  text: RevisedText;
  mentions?: MarkdownProps['mentions'];
  imageIds: readonly string[];
  onClose: () => void;
}) {
  const t = useTranslations('comments');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const revisions = useInfiniteQuery(
    'commentId' in text
      ? commentRevisionsQueryOptions(browserApiClient, text.commentId)
      : descriptionRevisionsQueryOptions(browserApiClient, text.ticketId),
  );
  const items = revisions.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('history.title')}</DialogTitle>
          <DialogDescription>{t('history.description')}</DialogDescription>
        </DialogHeader>
        <ol className="flex max-h-96 flex-col gap-4 overflow-y-auto">
          {items.map((revision) => (
            <li key={revision.id} className="flex flex-col gap-1 border-b border-border pb-3">
              <span className="text-sm text-muted-foreground">
                {t('history.writtenBy', {
                  person:
                    revision.author === null
                      ? t('customer')
                      : (revision.author.displayName ?? t('unknownPerson')),
                  time: format.dateTime(new Date(revision.writtenAt), {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }),
                })}
              </span>
              <Markdown attachmentImageIds={imageIds} mentions={mentions}>
                {revision.body}
              </Markdown>
            </li>
          ))}
        </ol>
        {revisions.isSuccess && items.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
        )}
        {revisions.isError && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(revisions.error)}
          </p>
        )}
        {revisions.hasNextPage && (
          <Button
            variant="outline"
            className="w-full md:w-fit"
            disabled={revisions.isFetchingNextPage}
            onClick={() => void revisions.fetchNextPage()}
          >
            {t('history.showMore')}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
