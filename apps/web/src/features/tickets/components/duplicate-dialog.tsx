'use client';

import { useQuery } from '@tanstack/react-query';
import { type Ticket, ticketIdentifierSchema } from '@trybun/contracts/tickets';
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
import { Field, FieldDescription, FieldError, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { useTranslations } from 'next-intl';
import { useDeferredValue, useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useChangeTicketStatus } from '../mutations.js';
import { projectTicketQueryOptions } from '../queries.js';

/** The errors of the original that belong to its field (S1-06). */
const ORIGINAL_ERRORS = new Set(['ticket.duplicate_of_self', 'ticket.duplicate_other_project']);

/**
 * The identifier the person means: upper case, and a bare number in the ticket's own project
 * (`7` → `ERP-7`), so the shortest input works (Rule 2).
 */
function identifierOf(text: string, projectKey: string): string {
  const typed = text.trim().toUpperCase();
  return /^[1-9][0-9]*$/.test(typed) ? `${projectKey}-${typed}` : typed;
}

/**
 * Marking a ticket as a duplicate (§3.5, §4.3): the **Original ticket** takes an identifier of the
 * same project, resolved with the list of the project's tickets and shown with its title before
 * the move is confirmed, then sent as `duplicateOfTicketId`. The errors of S1-06 – the ticket
 * itself, another project – appear on the field. Open while it is rendered; the move is confirmed
 * here, so it has no Undo (Q10). A search by title comes with S2-03.
 */
export function DuplicateDialog({
  ticket,
  onDone,
  onClose,
}: {
  ticket: Ticket;
  /** After the ticket is marked as a duplicate. */
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('tickets.status');
  const errorMessage = useErrorMessage();
  const changeStatus = useChangeTicketStatus();
  const [text, setText] = useState('');
  const [error, setError] = useState<{ code: string | undefined; isField: boolean } | null>(null);
  const identifier = useDeferredValue(identifierOf(text, ticket.project.key));
  const isIdentifier = ticketIdentifierSchema.safeParse(identifier).success;
  const original = useQuery({
    ...projectTicketQueryOptions(browserApiClient, ticket.projectId, identifier),
    enabled: isIdentifier,
  });
  const found = isIdentifier ? original.data : undefined;
  const isNotFound = isIdentifier && original.isSuccess && original.data === null;
  const fieldError =
    error?.isField === true
      ? errorMessage(error.code)
      : isNotFound
        ? t('originalNotFound', { identifier })
        : text.trim() !== '' && !isIdentifier
          ? t('originalInvalid')
          : undefined;

  const confirm = async () => {
    if (found === undefined || found === null) {
      return;
    }
    setError(null);
    try {
      // The ticket of the latest render: after a refused change, its version is the current one.
      await changeStatus.mutateAsync({
        ticket,
        input: { status: 'duplicate', duplicateOfTicketId: found.id },
      });
      onDone();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : undefined;
      setError({ code, isField: code !== undefined && ORIGINAL_ERRORS.has(code) });
    }
  };

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
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void confirm();
          }}
          className="flex flex-col gap-4"
        >
          <DialogHeader>
            <DialogTitle>{t('duplicateTitle', { identifier: ticket.identifier })}</DialogTitle>
            <DialogDescription>{t('duplicateDescription')}</DialogDescription>
          </DialogHeader>
          <Field invalid={fieldError !== undefined}>
            <FieldLabel>{t('original')}</FieldLabel>
            <Input
              value={text}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              placeholder={`${ticket.project.key}-7`}
              className="font-mono"
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
            />
            {found !== undefined && found !== null && (
              <FieldDescription>
                {t('originalFound', { identifier: found.identifier, title: found.title })}
              </FieldDescription>
            )}
            <FieldError errors={[fieldError === undefined ? undefined : { message: fieldError }]} />
          </Field>
          {error !== null && !error.isField && (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage(error.code)}
            </p>
          )}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              {t('cancel')}
            </DialogClose>
            <Button
              type="submit"
              disabled={found === undefined || found === null || changeStatus.isPending}
            >
              {t('duplicateConfirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
