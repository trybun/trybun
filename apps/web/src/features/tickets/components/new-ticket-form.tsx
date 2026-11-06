'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type CreateTicketDto, createTicketSchema } from '@trybun/contracts/tickets';
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
import { portalProjectHref, portalTicketHref } from '../../portal/hrefs.js';
import { useCreateTicket } from '../mutations.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';

/**
 * The simplified ticket form of end users (§3.3): the title and the description, whose placeholder
 * is the end-user template of §3.4 in the creator's language (Q9). The ticket is created with the
 * defaults of §5.1 (only the requester sees it) until S1-11 adds the visibility switch (Q8), and
 * S1-08 adds the attachments. **Submit** stays disabled while the request is pending, so a double
 * press creates one ticket (Q20); after it the new ticket opens with a toast.
 */
export function NewTicketForm({ projectId }: { projectId: string }) {
  const t = useTranslations('portal.newTicket');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const createTicket = useCreateTicket();
  const form = useForm<CreateTicketDto>({
    resolver: zodResolver(createTicketSchema, FORM_ERROR_MAP),
    defaultValues: { projectId, title: '', description: '' },
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
              />
              <FieldError
                errors={[fieldState.error && { message: errorMessage(fieldState.error.message) }]}
              />
            </Field>
          )}
        />
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
          disabled={form.formState.isSubmitting || createTicket.isSuccess}
        >
          {t('submit')}
        </Button>
      </div>
    </form>
  );
}
