'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Ticket, ticketRejectionReasonSchema } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@trybun/ui/components/dialog';
import { Field, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { useTranslations } from 'next-intl';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP } from '../../../lib/errors/form-errors.js';
import { useChangeTicketStatus } from '../mutations.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';

const rejectSchema = z.object({ rejectionReason: ticketRejectionReasonSchema });
type RejectValues = z.infer<typeof rejectSchema>;

/**
 * Rejecting a ticket (§4.3): the reason is required – 1 to 2000 characters after trimming – and is
 * published to the requester (S1-12), which the dialog says. A refusal keeps the typed reason and
 * shows its message, for `412` the standard conflict message (§17.2). Open while it is rendered;
 * the move is confirmed here, so it has no Undo (Q10).
 */
export function RejectDialog({
  ticket,
  onDone,
  onClose,
}: {
  ticket: Ticket;
  /** After the ticket is rejected. */
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('tickets.status');
  const errorMessage = useErrorMessage();
  const changeStatus = useChangeTicketStatus();
  const form = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema, FORM_ERROR_MAP),
    defaultValues: { rejectionReason: '' },
  });

  const submit = form.handleSubmit(async ({ rejectionReason }) => {
    try {
      // The ticket of the latest render: after a refused change, its version is the current one.
      await changeStatus.mutateAsync({ ticket, input: { status: 'rejected', rejectionReason } });
      onDone();
    } catch (error) {
      form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
    }
  });
  const rootError = form.formState.errors.root;

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
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('rejectTitle', { identifier: ticket.identifier })}</DialogTitle>
            <DialogDescription>{t('rejectDescription')}</DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="rejectionReason"
            render={({ field, fieldState }) => (
              <Field invalid={fieldState.invalid}>
                <FieldLabel>{t('reason')}</FieldLabel>
                <LazyMarkdownEditor
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  invalid={fieldState.invalid}
                />
                <FieldError
                  errors={[
                    fieldState.error && {
                      message: errorMessage(fieldState.error.message, {
                        'string.empty': t('reasonRequired'),
                      }),
                    },
                  ]}
                />
              </Field>
            )}
          />
          {rootError !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(rootError.message)}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t('cancel')}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={form.formState.isSubmitting}>
              {t('rejectConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
