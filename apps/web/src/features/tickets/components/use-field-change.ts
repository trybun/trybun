'use client';

import type { Ticket, UpdateTicketDto } from '@trybun/contracts/tickets';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useUpdateTicket } from '../mutations.js';

/**
 * A change of a field that saves on selection (Q10): the toast names the change and, with an
 * `inverse`, offers **Undo**, sent with the version the change returned. Undo is a change of its
 * own with its own event; refused (`412`, `403`, `422`) it shows the message and the ticket is read
 * again (`useUpdateTicket`), and it is never retried.
 */
export function useFieldChange(ticket: Ticket) {
  const t = useTranslations('tickets');
  const errorMessage = useErrorMessage();
  const updateTicket = useUpdateTicket();
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });
  const apply = (input: UpdateTicketDto, inverse: UpdateTicketDto | undefined, title: string) =>
    updateTicket.mutate(
      { ticket, input },
      {
        onSuccess: (updated) =>
          toast.add({
            title,
            type: 'success',
            ...(inverse === undefined
              ? {}
              : {
                  actionProps: {
                    children: t('view.undo'),
                    onClick: () =>
                      void updateTicket
                        .mutateAsync({ ticket: updated, input: inverse })
                        .catch(showError),
                  },
                }),
          }),
        onError: showError,
      },
    );
  return { apply, isPending: updateTicket.isPending, variables: updateTicket.variables };
}
