'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTicketDto } from '@trybun/contracts/tickets';
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
