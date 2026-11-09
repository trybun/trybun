'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ticketRejectionReasonSchema } from '@trybun/contracts/tickets';
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
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP } from '../../../lib/errors/form-errors.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';

const rejectSchema = z.object({ rejectionReason: ticketRejectionReasonSchema });
type RejectValues = z.infer<typeof rejectSchema>;

/**
 * The one reason of a bulk rejection (§8.1, S1-13): the same field and limits as the rejection of
 * one ticket (S1-10's `RejectDialog`), used for every selected ticket – each publishes it as its
 * own public comment (S1-12). It only collects the reason; the bulk change sends it. Open while
 * it is rendered.
 */
export function BulkRejectDialog({
  count,
  onReject,
  onClose,
}: {
  count: number;
  onReject: (rejectionReason: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const form = useForm<RejectValues>({
    resolver: zodResolver(rejectSchema, FORM_ERROR_MAP),
    defaultValues: { rejectionReason: '' },
  });
  const submit = form.handleSubmit(({ rejectionReason }) => onReject(rejectionReason));

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
            <DialogTitle>{t('list.bulk.rejectTitle', { count })}</DialogTitle>
            <DialogDescription>{t('list.bulk.rejectDescription')}</DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="rejectionReason"
            render={({ field, fieldState }) => (
              <Field invalid={fieldState.invalid}>
                <FieldLabel>{t('status.reason')}</FieldLabel>
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
                        'string.empty': t('status.reasonRequired'),
                      }),
                    },
                  ]}
                />
              </Field>
            )}
          />
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t('status.cancel')}
            </DialogClose>
            <Button type="submit" variant="destructive">
              {t('list.bulk.rejectConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
