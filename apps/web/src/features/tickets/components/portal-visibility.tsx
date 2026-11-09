'use client';

import type { TicketResponse, TicketVisibility } from '@trybun/contracts/tickets';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useIsTicketChanging, useSetTicketVisibility } from '../mutations.js';
import { shownVisibility, ticketVisibilityOptions } from '../visibility.js';
import { VisibilityChoice } from './visibility-choice.js';

/**
 * The visibility of a ticket in the portal (§5.1–§5.3, S1-11): "Visible to" with the state of a
 * sharing request, and – when the ticket's `allowedActions` permit a change – the same control as
 * the form. A pending request shows **All customers**; choosing **Only me** or **My organization**
 * withdraws it. The change saves on selection with a toast; while it is pending, the control
 * waits for it.
 */
export function PortalVisibility({ ticket }: { ticket: TicketResponse }) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const setVisibility = useSetTicketVisibility();
  const isChanging = useIsTicketChanging(ticket.id);
  const options = ticketVisibilityOptions(ticket);
  const shown =
    setVisibility.isPending && setVisibility.variables.ticket.id === ticket.id
      ? setVisibility.variables.input.visibility
      : shownVisibility(ticket);

  const choose = (visibility: TicketVisibility) => {
    if (visibility === shownVisibility(ticket)) {
      return;
    }
    const title =
      visibility === 'all_customers'
        ? t('visibility.requested')
        : ticket.sharingRequest === 'pending'
          ? t('visibility.withdrawn')
          : t('visibility.changed', { visibility: t(`visibilities.${visibility}`) });
    setVisibility.mutate(
      { ticket, input: { visibility } },
      {
        onSuccess: () => toast.add({ title, type: 'success' }),
        onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
      },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        {t('visibility.visibleTo', { visibility: t(`visibilities.${ticket.visibility}`) })}
      </p>
      {ticket.sharingRequest === 'pending' && (
        <p className="text-sm text-muted-foreground">{t('visibility.pending')}</p>
      )}
      {ticket.sharingRequest === 'rejected' && (
        <p className="text-sm text-muted-foreground">
          {t('visibility.rejected')}
          {ticket.visibility === 'my_organization' && ` ${t('visibility.rejectedOrganization')}`}
        </p>
      )}
      {options.length > 1 && (
        <VisibilityChoice
          options={options}
          value={shown}
          disabled={isChanging}
          onValueChange={choose}
        />
      )}
    </div>
  );
}
