'use client';

import {
  isTerminalStatus,
  type Ticket,
  type TicketResponse,
  type TicketStatus,
  ticketStatusSchema,
} from '@trybun/contracts/tickets';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useChangeTicketStatus, useIsTicketChanging } from '../mutations.js';
import type { PickerGroup } from './field-sheet.js';
import { FieldPicker } from './field-picker.js';
import { LazyDuplicateDialog } from './lazy-duplicate-dialog.js';
import { LazyRejectDialog } from './lazy-reject-dialog.js';

/** The internal statuses by kind (§4.1), in the order of the main flow. */
export const STATUS_KINDS = [
  { kind: 'initial', statuses: ['new'] },
  { kind: 'active', statuses: ['triage', 'todo', 'in_progress', 'in_verification'] },
  { kind: 'paused', statuses: ['waiting_for_requester'] },
  { kind: 'terminal', statuses: ['done', 'rejected', 'duplicate'] },
] as const satisfies readonly { kind: string; statuses: readonly TicketStatus[] }[];

/** A status the control asks about in a dialog before it is set. */
type DialogStatus = 'rejected' | 'duplicate';

/** Whether a ticket waits for its requester's confirmation of the resolution (§4.3). */
function isWaitingForConfirmation(ticket: Pick<Ticket, 'status' | 'waitingReason'>): boolean {
  return ticket.status === 'waiting_for_requester' && ticket.waitingReason === 'confirmation';
}

/**
 * Whether a status change has Undo (Q10): only a move between non-terminal statuses, never out of
 * a wait for the requester's confirmation – the inverse would ask for information and cancel the
 * confirmation (§4.3) – and never a `done` redirected to that wait. Moves into or out of a
 * terminal status reopen or close the ticket with events of their own (S1-06).
 */
export function hasStatusUndo(
  before: Pick<Ticket, 'status' | 'waitingReason'>,
  after: Pick<Ticket, 'status' | 'waitingReason'>,
  requested: TicketStatus,
): boolean {
  const isRedirected = requested !== after.status;
  return (
    !isRedirected &&
    !isTerminalStatus(before.status) &&
    !isTerminalStatus(after.status) &&
    !isWaitingForConfirmation(before)
  );
}

/**
 * The internal status of a ticket in the field panel (§4.1): with `change_status` a select of the
 * nine statuses grouped by kind, otherwise text; a ticket waiting for the requester shows why.
 * `rejected` and `duplicate` open their dialog first (S1-06); a `done` that the project turns into
 * a wait for the requester's confirmation says so. A change between non-terminal statuses offers
 * **Undo** (`hasStatusUndo`).
 */
export function StatusControl({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const changeStatus = useChangeTicketStatus();
  const isChanging = useIsTicketChanging(ticket.id);
  const [dialog, setDialog] = useState<DialogStatus | null>(null);
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });
  const waitingReason = ticket.waitingReason !== null && (
    <span className="block text-muted-foreground">
      {t(`waitingReasons.${ticket.waitingReason}`)}
    </span>
  );

  if (!ticket.allowedActions.includes('change_status')) {
    return (
      <>
        {t(`statuses.${ticket.status}`)}
        {waitingReason}
      </>
    );
  }

  const announce = (updated: TicketResponse, requested: TicketStatus) => {
    if (!('status' in updated)) {
      return;
    }
    if (requested === 'done' && isWaitingForConfirmation(updated)) {
      toast.add({ title: t('status.confirmationRequested'), type: 'info' });
      return;
    }
    // A status with Undo is never terminal, so it needs no dialog's field either.
    const previous = ticket.status;
    const canUndo =
      hasStatusUndo(ticket, updated, requested) &&
      previous !== 'rejected' &&
      previous !== 'duplicate';
    toast.add({
      title: t('status.changed', { status: t(`statuses.${updated.status}`) }),
      type: 'success',
      ...(canUndo
        ? {
            actionProps: {
              children: t('view.undo'),
              onClick: () =>
                void changeStatus
                  .mutateAsync({ ticket: updated, input: { status: previous } })
                  .catch(showError),
            },
          }
        : {}),
    });
  };

  const choose = (value: string) => {
    const status = ticketStatusSchema.parse(value);
    if (status === 'rejected' || status === 'duplicate') {
      setDialog(status);
      return;
    }
    changeStatus.mutate(
      { ticket, input: { status } },
      { onSuccess: (updated) => announce(updated, status), onError: showError },
    );
  };

  const groups: PickerGroup[] = STATUS_KINDS.map(({ kind, statuses }) => ({
    label: t(`status.kinds.${kind}`),
    options: statuses.map((status) => ({ value: status, label: t(`statuses.${status}`) })),
  }));
  const shown =
    changeStatus.isPending && changeStatus.variables.input.status !== ticket.status
      ? changeStatus.variables.input.status
      : ticket.status;
  const close = () => setDialog(null);
  const done = (status: DialogStatus) => {
    setDialog(null);
    toast.add({
      title: t('status.changed', { status: t(`statuses.${status}`) }),
      type: 'success',
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <FieldPicker
        label={t('view.fields.status')}
        value={shown}
        placeholder={t(`statuses.${ticket.status}`)}
        groups={groups}
        disabled={isChanging}
        onValueChange={choose}
      />
      {waitingReason}
      {dialog === 'rejected' && (
        <LazyRejectDialog ticket={ticket} onDone={() => done('rejected')} onClose={close} />
      )}
      {dialog === 'duplicate' && (
        <LazyDuplicateDialog ticket={ticket} onDone={() => done('duplicate')} onClose={close} />
      )}
    </div>
  );
}
