'use client';

import {
  type Ticket,
  type TicketVisibility,
  ticketVisibilitySchema,
} from '@trybun/contracts/tickets';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useIsTicketChanging, useSetTicketVisibility } from '../mutations.js';
import { ticketVisibilityOptions } from '../visibility.js';
import { FieldPicker } from './field-picker.js';
import { LazyRefuseSharingDialog, LazyShareDialog } from './lazy-sharing-dialogs.js';

type SharingDialog = 'share' | 'approve' | 'refuse';

/**
 * The visibility of an end user's ticket in the team's field panel (§5.1–§5.3, S1-11): the
 * current value, and a select of the permitted changes from the ticket's `allowedActions`.
 * **All customers** opens the confirmation of sharing; the other values save on selection with a
 * toast. A pending request shows the badge "Sharing requested" with **Share with all customers**
 * and **Refuse**, a refused one the badge and its reason, which only the team sees until S1-12.
 * Tickets of the team and of integrations have no visibility (Q6), so the panel leaves the field
 * out for them.
 */
export function VisibilityControl({ ticket }: { ticket: Ticket }) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const setVisibility = useSetTicketVisibility();
  const isChanging = useIsTicketChanging(ticket.id);
  const [dialog, setDialog] = useState<SharingDialog | null>(null);
  const options = ticketVisibilityOptions(ticket);
  const can = (action: Ticket['allowedActions'][number]) => ticket.allowedActions.includes(action);
  const shown =
    setVisibility.isPending && setVisibility.variables.ticket.id === ticket.id
      ? setVisibility.variables.input.visibility
      : ticket.visibility;

  const choose = (value: string) => {
    const visibility: TicketVisibility = ticketVisibilitySchema.parse(value);
    if (visibility === ticket.visibility) {
      return;
    }
    if (visibility === 'all_customers') {
      setDialog('share');
      return;
    }
    setVisibility.mutate(
      { ticket, input: { visibility } },
      {
        onSuccess: () =>
          toast.add({
            title: t('visibility.changed', { visibility: t(`visibilities.${visibility}`) }),
            type: 'success',
          }),
        onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
      },
    );
  };
  const close = () => setDialog(null);
  const done = (title: string) => {
    setDialog(null);
    toast.add({ title, type: 'success' });
  };

  return (
    <div className="flex flex-col items-start gap-2">
      {options.length > 1 ? (
        <FieldPicker
          label={t('view.fields.visibility')}
          value={shown}
          placeholder={t(`visibilities.${ticket.visibility}`)}
          groups={[
            {
              label: '',
              options: options.map((option) => ({
                value: option,
                label: t(`visibilities.${option}`),
              })),
            },
          ]}
          disabled={isChanging}
          onValueChange={choose}
        />
      ) : (
        t(`visibilities.${ticket.visibility}`)
      )}
      {ticket.sharingRequest === 'pending' && (
        <>
          <Badge variant="secondary">{t('visibility.sharingRequested')}</Badge>
          {(can('approve_sharing') || can('reject_sharing')) && (
            <div className="flex flex-wrap gap-2">
              {can('approve_sharing') && (
                <Button size="sm" disabled={isChanging} onClick={() => setDialog('approve')}>
                  {t('visibility.share')}
                </Button>
              )}
              {can('reject_sharing') && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isChanging}
                  onClick={() => setDialog('refuse')}
                >
                  {t('visibility.refuse')}
                </Button>
              )}
            </div>
          )}
        </>
      )}
      {ticket.sharingRequest === 'rejected' && (
        <>
          <Badge variant="outline">{t('visibility.sharingRefused')}</Badge>
          {/* The reason is a public comment of the timeline (S1-12 Q14). */}
          <span className="text-muted-foreground">{t('visibility.refusalReasonInTimeline')}</span>
        </>
      )}
      {(dialog === 'share' || dialog === 'approve') && (
        <LazyShareDialog
          ticket={ticket}
          approve={dialog === 'approve'}
          onDone={() => done(t('visibility.shared'))}
          onClose={close}
        />
      )}
      {dialog === 'refuse' && (
        <LazyRefuseSharingDialog
          ticket={ticket}
          onDone={() => done(t('visibility.refused'))}
          onClose={close}
        />
      )}
    </div>
  );
}
