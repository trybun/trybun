'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type TicketResponse, ticketTitleSchema } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { PencilIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from '../../../lib/errors/form-errors.js';
import { useIsTicketChanging, useUpdateTicket } from '../mutations.js';

const titleFormSchema = z.object({ title: ticketTitleSchema });
type TitleValues = z.infer<typeof titleFormSchema>;

/**
 * The title of a ticket (§3.2), editable in place with `update`: **Edit title** turns it into a
 * field saved with **Save** or Enter and cancelled with Escape or **Cancel**. After a refusal the
 * field keeps the typed title and shows the message – for `412` the standard conflict message
 * (§17.2), while the ticket is read again.
 */
export function TicketTitle({ ticket }: { ticket: TicketResponse }) {
  const t = useTranslations('tickets');
  const [isEditing, setIsEditing] = useState(false);
  // The focus returns to **Edit title** when the field closes.
  const returnsFocus = useRef(false);
  if (isEditing) {
    return (
      <>
        <h1 className="sr-only">{ticket.title}</h1>
        <TitleForm
          ticket={ticket}
          onClose={() => {
            returnsFocus.current = true;
            setIsEditing(false);
          }}
        />
      </>
    );
  }
  return (
    <div className="flex items-start gap-1">
      <h1 className="min-w-0 flex-1 text-2xl font-bold break-words">{ticket.title}</h1>
      {ticket.allowedActions.includes('update') && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('view.editTitle')}
          ref={(button) => {
            if (button !== null && returnsFocus.current) {
              returnsFocus.current = false;
              button.focus();
            }
          }}
          onClick={() => setIsEditing(true)}
        >
          <PencilIcon aria-hidden />
        </Button>
      )}
    </div>
  );
}

function TitleForm({ ticket, onClose }: { ticket: TicketResponse; onClose: () => void }) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const updateTicket = useUpdateTicket();
  // Its own change or one of another field: either sends the version this one would send (412).
  const isChanging = useIsTicketChanging(ticket.id);
  const input = useRef<HTMLInputElement>(null);
  const form = useForm<TitleValues>({
    resolver: zodResolver(titleFormSchema, FORM_ERROR_MAP),
    defaultValues: { title: ticket.title },
  });
  // The field opens focused, with the title selected for typing over it.
  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const submit = form.handleSubmit(async ({ title }) => {
    if (title === ticket.title) {
      onClose();
      return;
    }
    try {
      // The ticket of the latest render: after a refused change, its version is the current one.
      await updateTicket.mutateAsync({ ticket, input: { title } });
      onClose();
    } catch (error) {
      // The messages of the form hold error codes, translated where they are shown.
      const fieldErrors = error instanceof ApiError ? fieldErrorsOf(error) : [];
      const titleError = fieldErrors.find(({ field }) => field === 'title');
      if (titleError === undefined) {
        form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
      } else {
        form.setError('title', { message: titleError.code });
      }
    }
  });
  const rootError = form.formState.errors.root;

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3 md:flex-row md:items-start"
    >
      <Controller
        control={form.control}
        name="title"
        render={({ field, fieldState }) => (
          <Field invalid={fieldState.invalid} className="md:flex-1">
            <FieldLabel className="sr-only">{t('view.title')}</FieldLabel>
            <Input
              {...field}
              ref={(element) => {
                field.ref(element);
                input.current = element;
              }}
              autoComplete="off"
              className="text-lg font-semibold"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  onClose();
                }
              }}
            />
            <FieldError
              errors={[
                fieldState.error && {
                  message: errorMessage(fieldState.error.message, {
                    'string.empty': t('view.titleRequired'),
                  }),
                },
              ]}
            />
            {rootError !== undefined && (
              <p role="alert" className="text-sm text-destructive">
                {errorMessage(rootError.message)}
              </p>
            )}
          </Field>
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" className="flex-1 md:flex-none" disabled={isChanging}>
          {updateTicket.isPending ? t('view.saving') : t('view.save')}
        </Button>
        <Button type="button" variant="outline" className="flex-1 md:flex-none" onClick={onClose}>
          {t('view.cancel')}
        </Button>
      </div>
    </form>
  );
}
