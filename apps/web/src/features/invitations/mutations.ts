'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AcceptInvitationDto, CreateInvitationDto } from '@trybun/contracts/invitations';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';

/**
 * Invalidates the invitations and the projects: issuing can also grant access directly, which
 * adds a member (§7.4).
 */
function useInvalidateInvitations() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
      queryClient.invalidateQueries({ queryKey: ['projects'] }),
    ]);
}

/** Issues an invitation with its link, or grants the access to an active account (§7.4). */
export function useCreateInvitation() {
  const invalidate = useInvalidateInvitations();
  return useMutation({
    mutationFn: (input: CreateInvitationDto) =>
      dataOf(browserApiClient.POST('/api/v1/invitations', { body: input })),
    onSettled: () => invalidate(),
  });
}

/** A new link for an invitation; the old link stops working (§7.4). */
export function useResendInvitation() {
  const invalidate = useInvalidateInvitations();
  return useMutation({
    mutationFn: (invitationId: string) =>
      dataOf(
        browserApiClient.POST('/api/v1/invitations/{invitationId}/resending', {
          params: { path: { invitationId } },
        }),
      ),
    onSettled: () => invalidate(),
  });
}

/** Revokes a pending invitation (§7.4). */
export function useRevokeInvitation() {
  const invalidate = useInvalidateInvitations();
  return useMutation({
    mutationFn: (invitationId: string) =>
      dataOf(
        browserApiClient.POST('/api/v1/invitations/{invitationId}/revocation', {
          params: { path: { invitationId } },
        }),
      ),
    onSettled: () => invalidate(),
  });
}

/** Accepts an invitation with a password or with the session of a provider sign-in (ADR 0009). */
export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (input: AcceptInvitationDto) =>
      dataOf(browserApiClient.POST('/api/v1/invitations/acceptance', { body: input })),
  });
}
