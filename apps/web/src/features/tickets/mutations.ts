'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTicketDto, ResolutionAnswer } from '@trybun/contracts/tickets';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';

/** Invalidates every query of the tickets: the lists and the details. */
function useInvalidateTickets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['tickets'] });
}

/**
 * Creates a ticket (§3.3). The form disables **Submit** while the request is pending, so a double
 * press creates one ticket; the `Idempotency-Key` of §12.1 comes with S6-01 (Q20).
 */
export function useCreateTicket() {
  const invalidateTickets = useInvalidateTickets();
  return useMutation({
    mutationFn: (input: CreateTicketDto) =>
      dataOf(browserApiClient.POST('/api/v1/tickets', { body: input })),
    onSuccess: () => invalidateTickets(),
  });
}

/**
 * Answers "Is your problem solved?" (§4.3): the ticket and its timeline change, so both are read
 * again – also after a `409`, when the team or the timer answered first. The reading is not
 * awaited: the ticket read again no longer offers the answer, so the panel that sent it unmounts,
 * and TanStack Query would skip the callbacks of `mutate()` – its toast – after that.
 */
export function useConfirmResolution() {
  const queryClient = useQueryClient();
  const invalidateTickets = useInvalidateTickets();
  return useMutation({
    mutationFn: ({ ticketId, answer }: { ticketId: string; answer: ResolutionAnswer }) =>
      dataOf(
        browserApiClient.POST('/api/v1/tickets/{ticketId}/resolution-confirmation', {
          params: { path: { ticketId } },
          body: { answer },
        }),
      ),
    onSettled: () => {
      void Promise.all([
        invalidateTickets(),
        queryClient.invalidateQueries({ queryKey: ['activity-events'] }),
      ]);
    },
  });
}
