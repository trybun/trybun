'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ticketSharingRefusalReasonSchema } from '@trybun/contracts/tickets';
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
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { FORM_ERROR_MAP } from '../../../lib/errors/form-errors.js';
import Link from 'next/link';
import { type TicketVersion, useDecideSharing, useSetTicketVisibility } from '../mutations.js';
import { LazyMarkdownEditor } from './lazy-markdown-editor.js';

/** Closes a dialog that is open while it is rendered. */
function onOpenChangeOf(onClose: () => void) {
  return (open: boolean) => {
    if (!open) {
      onClose();
    }
  };
}

/**
 * Sharing a ticket with all customers (§5.2): the confirmation reminds the team to check the
 * content, which becomes visible to every customer of the project – the one extra step Rule 2
 * allows for predictability. `approve` decides a pending request; otherwise the team shares a
 * `my_organization` ticket at its own initiative. Open while it is rendered.
 */
export function ShareDialog({
  ticket,
  approve,
  viewHref,
  onDone,
  onClose,
}: {
  ticket: TicketVersion;
  approve: boolean;
  /**
   * The ticket view, linked where the dialog opens without the description – in the list, so the
   * team can check and redact the content first (§5.2, S1-13 Q11).
   */
  viewHref?: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('tickets.visibility');
  const errorMessage = useErrorMessage();
  const decide = useDecideSharing();
  const setVisibility = useSetTicketVisibility();
  const [error, setError] = useState<unknown>(null);
  const isPending = decide.isPending || setVisibility.isPending;

  const share = async () => {
    try {
      // The ticket of the latest render: after a refused change, its version is the current one.
      await (approve
        ? decide.mutateAsync({ ticket })
        : setVisibility.mutateAsync({ ticket, input: { visibility: 'all_customers' } }));
      onDone();
    } catch (caught) {
      setError(caught);
    }
  };

  return (
    <Dialog defaultOpen onOpenChange={onOpenChangeOf(onClose)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('shareTitle', { identifier: ticket.identifier })}</DialogTitle>
          <DialogDescription>{t('shareDescription')}</DialogDescription>
        </DialogHeader>
        {viewHref !== undefined && (
          <Link href={viewHref} className="text-sm font-medium underline underline-offset-4">
            {t('openTicketToCheck', { identifier: ticket.identifier })}
          </Link>
        )}
        {error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {errorMessage(error)}
          </p>
        )}
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline" />}>
            {t('cancel')}
          </DialogClose>
          <Button type="button" disabled={isPending} onClick={() => void share()}>
            {t('share')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const refuseSchema = z.object({ reason: ticketSharingRefusalReasonSchema });
type RefuseValues = z.infer<typeof refuseSchema>;

/**
 * Refusing a sharing request (§5.2): the reason is required – 1 to 2000 characters after
 * trimming – and stays with the team until S1-12 publishes it to the author (S1-11 Q8); the
 * visibility stays. A refusal keeps the typed reason and shows its message. Open while it is
 * rendered.
 */
export function RefuseSharingDialog({
  ticket,
  onDone,
  onClose,
}: {
  ticket: TicketVersion;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('tickets.visibility');
  const errorMessage = useErrorMessage();
  const decide = useDecideSharing();
  const form = useForm<RefuseValues>({
    resolver: zodResolver(refuseSchema, FORM_ERROR_MAP),
    defaultValues: { reason: '' },
  });

  const submit = form.handleSubmit(async ({ reason }) => {
    try {
      await decide.mutateAsync({ ticket, reason });
      onDone();
    } catch (error) {
      form.setError('root', { message: error instanceof ApiError ? error.code : undefined });
    }
  });
  const rootError = form.formState.errors.root;

  return (
    <Dialog defaultOpen onOpenChange={onOpenChangeOf(onClose)}>
      <DialogContent>
        <form noValidate onSubmit={(event) => void submit(event)} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{t('refuseTitle', { identifier: ticket.identifier })}</DialogTitle>
            <DialogDescription>{t('refuseDescription')}</DialogDescription>
          </DialogHeader>
          <Controller
            control={form.control}
            name="reason"
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
              {t('refuse')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
