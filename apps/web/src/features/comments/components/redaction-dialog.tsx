'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { CommentResponse } from '@trybun/contracts/comments';
import type { TicketResponse } from '@trybun/contracts/tickets';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { Button } from '@trybun/ui/components/button';
import { Checkbox } from '@trybun/ui/components/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@trybun/ui/components/dialog';
import { Field, FieldLabel } from '@trybun/ui/components/field';
import { TriangleAlertIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LazyMarkdownEditor } from '../../tickets/components/lazy-markdown-editor.js';
import { useRedactComment, useRedactDescription } from '../mutations.js';
import { commentRevisionsQueryOptions, descriptionRevisionsQueryOptions } from '../queries.js';

/** The text to redact: a comment or a ticket's description. */
export type RedactedText = { comment: CommentResponse } | { ticket: TicketResponse };

/**
 * Redaction (§6.1, §13.2, S1-12 Q9): the editor prefilled with the current text, which is replaced
 * and never kept, and the earlier versions as checkboxes – all checked, so with the default no
 * copy of the earlier text remains. The dialog warns that this cannot be undone, and that e-mails
 * already sent and backups keep the earlier text. A stale version is refused with `412`.
 */
export function RedactionDialog({
  text,
  imageIds,
  onClose,
}: {
  text: RedactedText;
  imageIds: readonly string[];
  onClose: () => void;
}) {
  const t = useTranslations('comments');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const redactComment = useRedactComment();
  const redactDescription = useRedactDescription();
  const [body, setBody] = useState('comment' in text ? text.comment.body : text.ticket.description);
  const revisions = useInfiniteQuery(
    'comment' in text
      ? commentRevisionsQueryOptions(browserApiClient, text.comment.id)
      : descriptionRevisionsQueryOptions(browserApiClient, text.ticket.id),
  );
  const items = revisions.data?.pages.flatMap((page) => page.items) ?? [];
  // Every earlier version is preselected (Q9); the person may keep some.
  const [kept, setKept] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | undefined>();
  const isPending = redactComment.isPending || redactDescription.isPending;
  const isCommentEmpty = 'comment' in text && body.trim() === '';

  const submit = async () => {
    const purgeRevisionIds = items.map(({ id }) => id).filter((id) => !kept.has(id));
    try {
      if ('comment' in text) {
        await redactComment.mutateAsync({
          comment: text.comment,
          input: { body, purgeRevisionIds },
        });
      } else {
        await redactDescription.mutateAsync({
          ticket: text.ticket,
          input: { description: body, purgeRevisionIds },
        });
      }
      onClose();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.code : undefined);
    }
  };

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
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>
              {'comment' in text ? t('redaction.commentTitle') : t('redaction.descriptionTitle')}
            </DialogTitle>
            <DialogDescription>{t('redaction.description')}</DialogDescription>
          </DialogHeader>
          <Alert variant="warning">
            <TriangleAlertIcon aria-hidden />
            <AlertDescription>{t('redaction.warning')}</AlertDescription>
          </Alert>
          <Field invalid={isCommentEmpty}>
            <FieldLabel>{t('redaction.text')}</FieldLabel>
            <LazyMarkdownEditor
              value={body}
              onValueChange={setBody}
              invalid={isCommentEmpty}
              attachmentImageIds={imageIds}
            />
          </Field>
          {items.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-medium">{t('redaction.versions')}</legend>
              {items.map((revision) => (
                <Field key={revision.id} orientation="horizontal">
                  <Checkbox
                    checked={!kept.has(revision.id)}
                    onCheckedChange={(checked) =>
                      setKept((current) => {
                        const next = new Set(current);
                        if (checked) {
                          next.delete(revision.id);
                        } else {
                          next.add(revision.id);
                        }
                        return next;
                      })
                    }
                  />
                  <FieldLabel className="font-normal">
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
                  </FieldLabel>
                </Field>
              ))}
            </fieldset>
          )}
          {revisions.hasNextPage && (
            // Every earlier version must be listed before a redaction, so the default selection
            // leaves no copy (Q9).
            <div className="flex flex-col gap-2">
              <p className="text-sm text-muted-foreground">{t('redaction.loadAll')}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full md:w-fit"
                disabled={revisions.isFetchingNextPage}
                onClick={() => void revisions.fetchNextPage()}
              >
                {t('history.showMore')}
              </Button>
            </div>
          )}
          {revisions.isError && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(revisions.error)}
            </p>
          )}
          {error !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(error)}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t('cancel')}
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              disabled={
                isPending ||
                isCommentEmpty ||
                !revisions.isSuccess ||
                revisions.hasNextPage ||
                revisions.isFetchingNextPage
              }
            >
              {t('redaction.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
