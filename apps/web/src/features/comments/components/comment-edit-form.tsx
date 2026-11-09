'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CommentResponse, commentBodySchema } from '@trybun/contracts/comments';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP } from '../../../lib/errors/form-errors.js';
import { useUnsavedChanges } from '../../../lib/forms/use-unsaved-changes.js';
import { LazyAttachmentDrafts } from '../../attachments/components/lazy-attachment-drafts.js';
import { useAttachmentDrafts } from '../../attachments/use-attachment-drafts.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { LazyMarkdownEditor } from '../../tickets/components/lazy-markdown-editor.js';
import { useUpdateComment } from '../mutations.js';
import { useMentionSearch } from '../use-mention-search.js';
import { useMentionedPeople } from '../use-mentioned-people.js';

const editFormSchema = z.object({ body: commentBodySchema, attachmentIds: z.array(z.uuid()) });
type EditValues = z.infer<typeof editFormSchema>;

/**
 * The own comment in the GFM editor (§6.1): **Save** keeps the replaced text as a revision, and
 * the comment shows "edited". A refused save keeps the typed text – a `412` shows the standard
 * conflict message (§17.2) while the timeline is read again. Unsaved text is not lost without a
 * question.
 */
export function CommentEditForm({
  comment,
  imageIds,
  attachmentMaxSizeMb,
  onClose,
}: {
  comment: CommentResponse;
  imageIds: readonly string[];
  attachmentMaxSizeMb: number;
  onClose: () => void;
}) {
  const t = useTranslations('comments');
  const errorMessage = useErrorMessage();
  const updateComment = useUpdateComment();
  const mentions = useMentionedPeople(comment.mentions);
  const kind = 'kind' in comment ? comment.kind : 'public';
  const mentionSearch = useMentionSearch(comment.ticketId, kind);
  const form = useForm<EditValues>({
    resolver: zodResolver(editFormSchema, FORM_ERROR_MAP),
    defaultValues: { body: comment.body, attachmentIds: [] },
  });
  const attachments = useAttachmentDrafts({
    form,
    textField: 'body',
    maxSizeMb: attachmentMaxSizeMb,
    ticketImageIds: imageIds,
  });
  const isDirty = form.formState.isDirty;
  const leaving = useUnsavedChanges(isDirty);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const submit = form.handleSubmit(async (values) => {
    try {
      await updateComment.mutateAsync({ comment, input: values });
      onClose();
    } catch (error) {
      form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
    }
  });
  const rootError = form.formState.errors.root;
  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <Controller
        control={form.control}
        name="body"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel className="sr-only">{t('editLabel')}</FieldLabel>
            <LazyMarkdownEditor
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              invalid={fieldState.invalid}
              mentions={mentions}
              onMentionSearch={mentionSearch}
              {...attachments.editorProps}
            />
            <FieldError
              errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
            />
          </Field>
        )}
      />
      <LazyAttachmentDrafts drafts={attachments.drafts} onRemove={attachments.removeDraft} />
      {rootError !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rootError.message)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full md:w-fit"
          onClick={() => (isDirty ? setIsDiscarding(true) : onClose())}
        >
          {t('cancel')}
        </Button>
        <Button
          type="submit"
          className="w-full md:w-fit"
          disabled={form.formState.isSubmitting || attachments.isUploading}
        >
          {t('save')}
        </Button>
      </div>
      {(isDiscarding || leaving.isAsking) && (
        <LazyConfirmDialog
          title={t('discard.title')}
          description={t('discard.description')}
          confirmLabel={t('discard.confirm')}
          cancelLabel={t('discard.cancel')}
          isDestructive
          onConfirm={() => {
            if (isDiscarding) {
              setIsDiscarding(false);
              onClose();
            } else {
              leaving.leave();
            }
          }}
          onClose={() => {
            setIsDiscarding(false);
            leaving.stay();
          }}
        />
      )}
    </form>
  );
}
