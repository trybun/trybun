'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  type CreateTicketDto,
  createTicketSchema,
  type TicketVisibility,
} from '@trybun/contracts/tickets';
import { Button, buttonVariants } from '@trybun/ui/components/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { toast } from '@trybun/ui/components/toast';
import { cn } from '@trybun/ui/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { LazyAttachmentDrafts } from '../../attachments/components/lazy-attachment-drafts.js';
import { useAttachmentDrafts } from '../../attachments/use-attachment-drafts.js';
import { portalProjectHref, portalTicketHref } from '../../portal/hrefs.js';
import { useCreateTicket } from '../mutations.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';
import { VisibilityChoice } from './visibility-choice.js';

/**
 * The simplified ticket form of end users (§3.3): the title and the description, whose placeholder
 * is the end-user template of §3.4 in the creator's language (Q9), with the files added in the
 * editor listed below it (S1-08 Q5, Q18), and the visibility below them with the options the API
 * allows for the project (S1-11 Q7) – **Only me** by default (§5.1), no control with only that
 * option, so the typical ticket needs no extra step (Rule 2). **Submit** stays disabled
 * while the request is pending, so a double press creates one ticket (Q20), and while a file is
 * still uploading; files still being checked are attached. After it the new ticket opens with a
 * toast.
 */
export function NewTicketForm({
  projectId,
  visibilityOptions,
  attachmentMaxSizeMb,
}: {
  projectId: string;
  /** The visibilities the person may choose in the project (`creationVisibilityOptions`). */
  visibilityOptions: readonly TicketVisibility[];
  /** `TRYBUN_ATTACHMENT_MAX_SIZE_MB` of the web server (§13.3). */
  attachmentMaxSizeMb: number;
}) {
  const t = useTranslations('portal.newTicket');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const createTicket = useCreateTicket();
  const form = useForm<CreateTicketDto>({
    resolver: zodResolver(createTicketSchema, FORM_ERROR_MAP),
    defaultValues: { projectId, title: '', description: '', visibility: 'only_me' },
  });
  const attachments = useAttachmentDrafts({
    form,
    textField: 'description',
    maxSizeMb: attachmentMaxSizeMb,
  });

  const submit = form.handleSubmit((input) =>
    createTicket
      .mutateAsync(input)
      .then((ticket) => {
        toast.add({ title: t('created', { identifier: ticket.identifier }), type: 'success' });
        router.push(portalTicketHref(ticket.identifier));
      })
      .catch((error: unknown) => {
        // The messages of the form hold error codes, translated where they are shown.
        const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
        for (const { field, code } of fieldErrors) {
          form.setError(field as keyof CreateTicketDto, { message: code });
        }
        if (fieldErrors.length === 0) {
          form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
        }
      }),
  );
  const rootError = form.formState.errors.root;

  return (
    <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <FieldGroup>
        <Controller
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('title')}</FieldLabel>
              <Input {...field} autoComplete="off" />
              <FieldError
                errors={[
                  fieldState.error && {
                    message: errorMessage(fieldState.error.message, {
                      'string.empty': t('titleRequired'),
                    }),
                  },
                ]}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field invalid={fieldState.invalid}>
              <FieldLabel>{t('description')}</FieldLabel>
              <LazyMarkdownEditor
                name={field.name}
                value={field.value ?? ''}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                invalid={fieldState.invalid}
                placeholder={t('placeholder')}
                {...attachments.editorProps}
              />
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
        <LazyAttachmentDrafts drafts={attachments.drafts} onRemove={attachments.removeDraft} />
        {visibilityOptions.length > 1 && (
          <Controller
            control={form.control}
            name="visibility"
            render={({ field }) => (
              <VisibilityChoice
                name={field.name}
                inputRef={field.ref}
                options={visibilityOptions}
                value={field.value ?? 'only_me'}
                onValueChange={field.onChange}
              />
            )}
          />
        )}
      </FieldGroup>
      {rootError !== undefined && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(rootError.message)}
        </p>
      )}
      <div className="flex flex-col-reverse gap-3 pb-safe-offset-0 md:flex-row md:justify-end">
        <Link
          href={portalProjectHref(projectId)}
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full md:w-fit')}
        >
          {t('cancel')}
        </Link>
        <Button
          type="submit"
          className="w-full md:w-fit"
          disabled={
            form.formState.isSubmitting || createTicket.isSuccess || attachments.isUploading
          }
        >
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
