'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Ticket, ticketDescriptionSchema } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { Markdown } from '@trybun/ui/components/markdown';
import { PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP } from '../../../lib/errors/form-errors.js';
import { useAddTicketAttachments } from '../../attachments/mutations.js';
import { LazyAttachmentDrafts } from '../../attachments/components/lazy-attachment-drafts.js';
import { useAttachmentDrafts } from '../../attachments/use-attachment-drafts.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { useUpdateTicket } from '../mutations.js';
import { useUnsavedChanges } from '../use-unsaved-changes.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';

const descriptionFormSchema = z.object({
  description: ticketDescriptionSchema,
  attachmentIds: z.array(z.uuid()),
});
type DescriptionValues = z.infer<typeof descriptionFormSchema>;

/**
 * The description of a ticket (§3.2): the rendered GFM with the ticket's images; with `update`,
 * **Edit** replaces it with the GFM editor and **Save** / **Cancel**.
 */
export function TicketDescription({
  ticket,
  imageIds,
  attachmentMaxSizeMb,
}: {
  ticket: Ticket;
  /** The available images of the ticket (`useTicketImageIds`). */
  imageIds: string[];
  /** `TRYBUN_ATTACHMENT_MAX_SIZE_MB` of the web server (§13.3). */
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('tickets');
  const [isEditing, setIsEditing] = useState(false);
  return (
    <section aria-labelledby="ticket-description" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ticket-description" className="text-lg font-semibold">
          {t('view.description')}
        </h2>
        {!isEditing && ticket.allowedActions.includes('update') && (
          <Button
            type="button"
            variant="outline"
            aria-label={t('view.editDescription')}
            onClick={() => setIsEditing(true)}
          >
            <PencilIcon aria-hidden />
            {t('view.edit')}
          </Button>
        )}
      </div>
      {isEditing ? (
        <DescriptionForm
          ticket={ticket}
          imageIds={imageIds}
          attachmentMaxSizeMb={attachmentMaxSizeMb}
          onClose={() => setIsEditing(false)}
        />
      ) : ticket.description === '' ? (
        <p className="text-sm text-muted-foreground">{t('view.noDescription')}</p>
      ) : (
        <Markdown attachmentImageIds={imageIds}>{ticket.description}</Markdown>
      )}
    </section>
  );
}

/**
 * The description in the GFM editor. With `add_attachment` files dropped, pasted or chosen in the
 * editor become drafts (S1-08), linked to the ticket when the description is saved – a ticket edit
 * links nothing itself (S1-08 Q4). A refused save keeps the typed text: a `412` shows the
 * standard conflict message (§17.2) while the ticket is read again, and **Save** then sends the
 * text with the new version. Unsaved text is not lost without a question – neither by **Cancel**
 * nor by leaving the page (Q10).
 */
function DescriptionForm({
  ticket,
  imageIds,
  attachmentMaxSizeMb,
  onClose,
}: {
  ticket: Ticket;
  imageIds: string[];
  attachmentMaxSizeMb: number;
  onClose: () => void;
}) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const updateTicket = useUpdateTicket();
  const addAttachments = useAddTicketAttachments();
  const form = useForm<DescriptionValues>({
    resolver: zodResolver(descriptionFormSchema, FORM_ERROR_MAP),
    defaultValues: { description: ticket.description, attachmentIds: [] },
  });
  const attachments = useAttachmentDrafts({
    form,
    textField: 'description',
    maxSizeMb: attachmentMaxSizeMb,
    ticketImageIds: imageIds,
  });
  const canAttach = ticket.allowedActions.includes('add_attachment');
  const isDirty = form.formState.isDirty;
  const leaving = useUnsavedChanges(isDirty);
  const [isDiscarding, setIsDiscarding] = useState(false);

  const submit = form.handleSubmit(async ({ description, attachmentIds }) => {
    try {
      // The ticket of the latest render: after a refused save, its version is the current one.
      if (description !== ticket.description) {
        await updateTicket.mutateAsync({ ticket, input: { description } });
      }
      if (attachmentIds.length > 0) {
        await addAttachments.mutateAsync({ ticketId: ticket.id, attachmentIds });
      }
      onClose();
    } catch (error) {
      form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
    }
  });
  const rootError = form.formState.errors.root;
  const isSaving = form.formState.isSubmitting;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-3">
      <Controller
        control={form.control}
        name="description"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid}>
            <FieldLabel className="sr-only">{t('view.description')}</FieldLabel>
            <LazyMarkdownEditor
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              invalid={fieldState.invalid}
              {...(canAttach ? attachments.editorProps : {})}
            />
            <FieldError
              errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
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
      <div className="flex flex-col-reverse gap-3 md:flex-row md:justify-end">
        <Button
          type="button"
          variant="outline"
          className="w-full md:w-fit"
          onClick={() => (isDirty ? setIsDiscarding(true) : onClose())}
        >
          {t('view.cancel')}
        </Button>
        <Button
          type="submit"
          className="w-full md:w-fit"
          disabled={isSaving || attachments.isUploading}
        >
          {isSaving ? t('view.saving') : t('view.save')}
        </Button>
      </div>
      {(isDiscarding || leaving.pendingHref !== null) && (
        <LazyConfirmDialog
          title={t('view.discard.title')}
          description={t('view.discard.description')}
          confirmLabel={t('view.discard.confirm')}
          cancelLabel={t('view.discard.cancel')}
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
