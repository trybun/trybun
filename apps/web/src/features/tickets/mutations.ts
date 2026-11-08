'use client';

import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  ChangeTicketStatusDto,
  CreateTicketDto,
  ResolutionAnswer,
  Ticket,
  TicketResponse,
  UpdateTicketDto,
} from '@trybun/contracts/tickets';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { activityEventsQueryOptions, ticketQueryOptions } from './queries.js';

/** Invalidates every query of the tickets: the lists and the details. */
function useInvalidateTickets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['tickets'] });
}

/** The weak ETag of the version the person has seen (§17.2). */
function ifMatch(ticket: Pick<Ticket, 'version'>) {
  return { 'If-Match': `W/"${ticket.version}"` };
}

/** A ticket as a change addresses it: its ID, its identifier and the version the person has seen. */
export type TicketVersion = Pick<Ticket, 'id' | 'identifier' | 'version'>;

/** The mutation key of every change of a ticket with `If-Match`: its fields and its status. */
const TICKET_CHANGE_KEY = ['tickets', 'change'] as const;

/**
 * Whether a change of the ticket is pending. Each change sends the version the person has seen, so
 * a second one sent before the first returns would be refused with `412` against the person's own
 * change: the controls of the ticket wait for it.
 */
export function useIsTicketChanging(ticketId: string): boolean {
  return (
    useIsMutating({
      mutationKey: TICKET_CHANGE_KEY,
      predicate: ({ state }) =>
        (state.variables as { ticket: TicketVersion } | undefined)?.ticket.id === ticketId,
    }) > 0
  );
}

/**
 * What a change of a ticket in the view does to the cache (§18.5): the ticket the API returns
 * replaces the cached one – so a following change, or its Undo, sends the new version – and its
 * timeline and the lists are read again. A refused change (`412` after someone else's change,
 * `403`, `422`) reads the ticket again, so the view shows what the server holds; it is never
 * retried.
 */
function useTicketChangeCallbacks() {
  const queryClient = useQueryClient();
  const refresh = (ticket: TicketVersion) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['tickets', 'list'] }),
      queryClient.invalidateQueries({
        queryKey: activityEventsQueryOptions(browserApiClient, ticket.id).queryKey,
      }),
    ]);
  return {
    onSuccess: (updated: TicketResponse) => {
      queryClient.setQueryData(
        ticketQueryOptions(browserApiClient, updated.identifier).queryKey,
        updated,
      );
      return refresh(updated);
    },
    onError: (_error: unknown, { ticket }: { ticket: TicketVersion }) => {
      void queryClient.invalidateQueries({
        queryKey: ticketQueryOptions(browserApiClient, ticket.identifier).queryKey,
      });
      void refresh(ticket);
    },
  };
}

/**
 * Changes the title, the description, the type, the priority or the assignee of a ticket (§3.2)
 * with `If-Match`. The view sends the inverse change with the returned version as Undo (Q10).
 */
export function useUpdateTicket() {
  return useMutation({
    mutationKey: TICKET_CHANGE_KEY,
    mutationFn: ({ ticket, input }: { ticket: TicketVersion; input: UpdateTicketDto }) =>
      dataOf(
        browserApiClient.PATCH('/api/v1/tickets/{ticketId}', {
          params: { path: { ticketId: ticket.id } },
          headers: ifMatch(ticket),
          body: input,
        }),
      ),
    ...useTicketChangeCallbacks(),
  });
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
 * Changes the internal status of a ticket (§4.3) with `If-Match`, with the reason of a rejection
 * or the original of a duplicate. A requested `done` may come back as a wait for the requester's
 * confirmation (S1-06); the view reads the status of the response.
 */
export function useChangeTicketStatus() {
  return useMutation({
    mutationKey: TICKET_CHANGE_KEY,
    mutationFn: ({ ticket, input }: { ticket: TicketVersion; input: ChangeTicketStatusDto }) =>
      dataOf(
        browserApiClient.PUT('/api/v1/tickets/{ticketId}/status', {
          params: { path: { ticketId: ticket.id } },
          headers: ifMatch(ticket),
          body: input,
        }),
      ),
    ...useTicketChangeCallbacks(),
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
