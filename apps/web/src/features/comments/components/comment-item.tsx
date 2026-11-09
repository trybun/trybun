'use client';

import type { CommentResponse } from '@trybun/contracts/comments';
import { AttachmentItem, AttachmentList } from '@trybun/ui/components/attachment-list';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@trybun/ui/components/dropdown-menu';
import { Markdown } from '@trybun/ui/components/markdown';
import { toast } from '@trybun/ui/components/toast';
import { attachmentContentPath } from '@trybun/ui/lib/attachment-path';
import { cn } from '@trybun/ui/lib/utils';
import { EllipsisIcon, LockIcon } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { attachmentStateOf } from '../../attachments/attachment-state.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { useDeleteComment } from '../mutations.js';
import { useMentionedPeople } from '../use-mentioned-people.js';
import { CommentEditForm } from './comment-edit-form.js';
import { LazyRedactionDialog } from './lazy-redaction-dialog.js';
import { LazyRevisionsDialog } from './lazy-revisions-dialog.js';

/** Whether the team's shape of a comment is an internal note (§6.1). */
function isInternalNote(comment: CommentResponse): boolean {
  return 'kind' in comment && comment.kind === 'internal';
}

/**
 * A comment in a ticket's timeline (§6.1, S1-12): its author – "Customer" when the identity rule
 * hides them (§5.4) – the time, the text with its mentions, images and files, and the actions
 * `allowedActions` permits in a "⋯" menu: **Edit**, **Delete** after a confirmation, **Redact**
 * (team). An internal note has its own background, a lock icon and the label "Internal note", so
 * colour is never the only signal (§13.4). "edited" opens the history for those who may read it;
 * for the others it is plain text.
 */
export function CommentItem({
  comment,
  imageIds,
  attachmentMaxSizeMb,
}: {
  comment: CommentResponse;
  /** The images the ticket's Markdown shows inline (§13.3). */
  imageIds: readonly string[];
  /** `TRYBUN_ATTACHMENT_MAX_SIZE_MB` of the web server (§13.3). */
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('comments');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const mentions = useMentionedPeople(comment.mentions);
  const deleteComment = useDeleteComment();
  const [dialog, setDialog] = useState<'edit' | 'delete' | 'redact' | 'history' | null>(null);
  const isNote = isInternalNote(comment);
  const can = (action: CommentResponse['allowedActions'][number]) =>
    comment.allowedActions.includes(action);
  const hasActions = can('update') || can('delete') || can('redact');
  const author =
    comment.author === null ? t('customer') : (comment.author.displayName ?? t('unknownPerson'));
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-lg border p-3',
        isNote ? 'border-warning/50 bg-warning/10' : 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium break-words">{author}</span>
          <time dateTime={comment.createdAt} className="text-muted-foreground">
            {format.dateTime(new Date(comment.createdAt), {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </time>
          {isNote && (
            <Badge variant="outline">
              <LockIcon aria-hidden />
              {t('internalNote')}
            </Badge>
          )}
          {comment.editedAt !== null &&
            (can('read_revisions') ? (
              <button
                type="button"
                className="min-h-11 text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
                aria-label={t('showHistory')}
                onClick={() => setDialog('history')}
              >
                {t('edited')}
              </button>
            ) : (
              <span className="text-muted-foreground">{t('edited')}</span>
            ))}
        </div>
        {hasActions && dialog !== 'edit' && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" />}
              aria-label={t('actions')}
            >
              <EllipsisIcon aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {can('update') && (
                <DropdownMenuItem onClick={() => setDialog('edit')}>{t('edit')}</DropdownMenuItem>
              )}
              {can('redact') && (
                <DropdownMenuItem onClick={() => setDialog('redact')}>
                  {t('redact')}
                </DropdownMenuItem>
              )}
              {can('delete') && (
                <DropdownMenuItem variant="destructive" onClick={() => setDialog('delete')}>
                  {t('delete')}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {dialog === 'edit' ? (
        <CommentEditForm
          comment={comment}
          imageIds={imageIds}
          attachmentMaxSizeMb={attachmentMaxSizeMb}
          onClose={() => setDialog(null)}
        />
      ) : (
        <Markdown attachmentImageIds={imageIds} mentions={mentions}>
          {comment.body}
        </Markdown>
      )}
      {comment.attachments.length > 0 && (
        <AttachmentList>
          {comment.attachments.map((attachment) => {
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
              />
            );
          })}
        </AttachmentList>
      )}
      {dialog === 'delete' && (
        <LazyConfirmDialog
          title={t('deleteDialog.title')}
          description={t('deleteDialog.description')}
          confirmLabel={t('deleteDialog.confirm')}
          cancelLabel={t('cancel')}
          isDestructive
          isPending={deleteComment.isPending}
          onConfirm={() =>
            deleteComment.mutate(
              { comment },
              {
                onSuccess: () => setDialog(null),
                onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
              },
            )
          }
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'history' && (
        <LazyRevisionsDialog
          text={{ commentId: comment.id }}
          imageIds={imageIds}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'redact' && (
        <LazyRedactionDialog
          text={{ comment }}
          imageIds={imageIds}
          onClose={() => setDialog(null)}
        />
      )}
    </li>
  );
}
