'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CommentKind, commentBodySchema, commentKindSchema } from '@trybun/contracts/comments';
import type { TicketResponse } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@trybun/ui/components/field';
import { RadioGroup, RadioGroupItem } from '@trybun/ui/components/radio-group';
import { cn } from '@trybun/ui/lib/utils';
import { LockIcon } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP } from '../../../lib/errors/form-errors.js';
import { useUnsavedChanges } from '../../../lib/forms/use-unsaved-changes.js';
import { LazyAttachmentDrafts } from '../../attachments/components/lazy-attachment-drafts.js';
import { useAttachmentDrafts } from '../../attachments/use-attachment-drafts.js';
import { newTicketHref } from '../../portal/hrefs.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { LazyMarkdownEditor } from '../../tickets/components/lazy-markdown-editor.js';
import { useAddComment } from '../mutations.js';
import { useMentionSearch } from '../use-mention-search.js';

const commentFormSchema = z.object({
  kind: commentKindSchema,
  body: commentBodySchema,
  attachmentIds: z.array(z.uuid()),
});
type CommentValues = z.infer<typeof commentFormSchema>;

/**
 * The comment field at the end of a ticket's timeline (§6.1, S1-12 Q17). For the team a switch
 * chooses between **Internal note** – preselected on every new form, so a technical discussion
 * never reaches the customer by accident – and **Public comment**, with a hint who will see it,
 * built from the ticket's visibility (§5.2); the submit button names the kind. In internal mode the
 * form has the note's background, a lock icon and the label, so colour is never the only signal.
 * An end user's comment is always public. Typing `@` suggests the people the comment may mention.
 * Without `add_comment` on a closed ticket the portal offers **Create a new ticket** (§4.3).
 */
export function CommentForm({
  ticket,
  isTeam,
  imageIds,
  attachmentMaxSizeMb,
}: {
  ticket: TicketResponse;
  isTeam: boolean;
  imageIds: readonly string[];
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('comments');
  if (!ticket.allowedActions.includes('add_comment')) {
    // The team cannot comment in an archived project, which the view's banner says already.
    return isTeam ? null : (
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <p className="text-sm text-muted-foreground">{t('closed')}</p>
        <Button
          render={<Link href={newTicketHref(ticket.projectId)} />}
          variant="outline"
          className="w-full md:w-fit"
        >
          {t('createNewTicket')}
        </Button>
      </div>
    );
  }
  return (
    <NewCommentForm
      ticket={ticket}
      isTeam={isTeam}
      imageIds={imageIds}
      attachmentMaxSizeMb={attachmentMaxSizeMb}
    />
  );
}

function NewCommentForm({
  ticket,
  isTeam,
  imageIds,
  attachmentMaxSizeMb,
}: {
  ticket: TicketResponse;
  isTeam: boolean;
  imageIds: readonly string[];
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('comments');
  const errorMessage = useErrorMessage();
  const addComment = useAddComment();
  const canAddNote = isTeam && ticket.allowedActions.includes('add_internal_note');
  const initialKind: CommentKind = canAddNote ? 'internal' : 'public';
  const form = useForm<CommentValues>({
    resolver: zodResolver(commentFormSchema, FORM_ERROR_MAP),
    defaultValues: { kind: initialKind, body: '', attachmentIds: [] },
  });
  const kind = useWatch({ control: form.control, name: 'kind' });
  const mentionSearch = useMentionSearch(ticket.id, kind);
  const attachments = useAttachmentDrafts({
    form,
    textField: 'body',
    maxSizeMb: attachmentMaxSizeMb,
    ticketImageIds: imageIds,
  });
  const canAttach = ticket.allowedActions.includes('add_attachment') || !isTeam;
  const isDirty = form.formState.dirtyFields.body === true;
  const leaving = useUnsavedChanges(isDirty);
  const isNote = kind === 'internal';

  const submit = form.handleSubmit(async (values) => {
    try {
      await addComment.mutateAsync({ ticketId: ticket.id, input: values });
      // A new form preselects the internal note again (§6.1).
      form.reset({ kind: initialKind, body: '', attachmentIds: [] });
    } catch (error) {
      form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
    }
  });
  const rootError = form.formState.errors.root;

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-3',
        isNote ? 'border-warning/50 bg-warning/10' : 'border-border',
      )}
    >
      {canAddNote && (
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">{t('kindLabel')}</FieldLegend>
              <RadioGroup
                className="grid-cols-1 gap-2 md:grid-cols-2"
                value={field.value}
                onValueChange={(next) => field.onChange(commentKindSchema.parse(next))}
              >
                {(['internal', 'public'] as const).map((option) => (
                  <FieldLabel key={option} className="min-h-11 xl:pointer-fine:min-h-0">
                    <Field orientation="horizontal">
                      <RadioGroupItem value={option} />
                      <FieldTitle>
                        {option === 'internal' && <LockIcon aria-hidden className="size-4" />}
                        {t(`kinds.${option}`)}
                      </FieldTitle>
                    </Field>
                  </FieldLabel>
                ))}
              </RadioGroup>
            </FieldSet>
          )}
        />
      )}
      {isTeam && kind === 'public' && (
        <p className="text-sm text-muted-foreground">
          {ticket.visibility === 'my_organization'
            ? t('audience.my_organization', { organization: organizationNameOf(ticket) })
            : t(`audience.${ticket.visibility}`)}
        </p>
      )}
      <Controller
        control={form.control}
        name="body"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel className={canAddNote ? 'sr-only' : undefined}>
              {isNote ? t('kinds.internal') : t('commentLabel')}
            </FieldLabel>
            <LazyMarkdownEditor
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              invalid={fieldState.invalid}
              onMentionSearch={mentionSearch}
              {...(canAttach ? attachments.editorProps : {})}
            />
            <FieldError
              errors={[
                fieldState.error && {
                  message: errorMessage(fieldState.error.message, {
                    'string.empty': t('bodyRequired'),
                  }),
                },
              ]}
            />
          </Field>
        )}
      />
      {canAttach && (
        <LazyAttachmentDrafts drafts={attachments.drafts} onRemove={attachments.removeDraft} />
      )}
      {rootError !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rootError.message)}
        </p>
      )}
      <div className="flex justify-end">
        <Button
          type="submit"
          className="w-full md:w-fit"
          disabled={form.formState.isSubmitting || attachments.isUploading}
        >
          {!isTeam ? t('submit') : isNote ? t('submitInternal') : t('submitPublic')}
        </Button>
      </div>
      {leaving.isAsking && (
        <LazyConfirmDialog
          title={t('discard.title')}
          description={t('discard.description')}
          confirmLabel={t('discard.confirm')}
          cancelLabel={t('discard.cancel')}
          isDestructive
          onConfirm={leaving.leave}
          onClose={leaving.stay}
        />
      )}
    </form>
  );
}

/** The organization of a ticket as the team's response names it (§5.2). */
function organizationNameOf(ticket: TicketResponse): string {
  return 'organization' in ticket ? (ticket.organization?.name ?? '') : '';
}
