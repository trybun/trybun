import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { CreateInvitationDto } from '@trybun/contracts/invitations';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/** The pending invitations of a project, newest first, page by page (§7.4). */
export function projectInvitationsQueryOptions(client: ApiClient, projectId: string) {
  return infiniteQueryOptions({
    queryKey: ['invitations', 'list', { projectId }],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/invitations', {
          params: {
            query: { projectId, ...(pageParam === null ? {} : { cursor: pageParam }) },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/**
 * What issuing an invitation would do, shown before sending (§7.4): a new invitation, perhaps with
 * the organization of the address's domain, or the access granted directly. It writes nothing, so
 * it is read as a query; a refusal is an answer, not a failure to retry.
 */
export function invitationPreviewQueryOptions(client: ApiClient, input: CreateInvitationDto) {
  return queryOptions({
    queryKey: ['invitations', 'preview', input],
    queryFn: ({ signal }) =>
      dataOf(client.POST('/api/v1/invitation-previews', { body: input, signal })),
    retry: false,
  });
}

/**
 * The check of an invitation link before the acceptance page shows it (ADR 0009). It changes
 * nothing, so it is read as a query; an invalid token is an answer, not a failure to retry.
 */
export function invitationTokenVerificationQueryOptions(client: ApiClient, token: string) {
  return queryOptions({
    queryKey: ['invitations', 'token-verification', token],
    queryFn: ({ signal }) =>
      dataOf(client.POST('/api/v1/invitations/token-verification', { body: { token }, signal })),
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
  });
}
