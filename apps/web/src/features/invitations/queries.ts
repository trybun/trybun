import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { CreateInvitationDto } from '@trybun/contracts/invitations';
import { MAX_PAGE_LIMIT } from '@trybun/contracts/pagination';
import type { User } from '@trybun/contracts/users';
import { allPageItems } from '../../lib/api-client/all-pages.js';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';

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
 * Whether the Accounts page reads the pending invitations of an account (§7.4): only an invited or
 * active account whose `pendingInvitationCount` says it has some, so a page of accounts without any
 * reads none. `usersQueryOptions` loads them with each page of accounts and `AccountInvitations`
 * reads them by this one rule, so an account is shown with its invitations (#310).
 */
export function hasPendingInvitations(user: User): boolean {
  return (user.state === 'invited' || user.state === 'active') && user.pendingInvitationCount > 0;
}

/**
 * The pending invitations of the accounts of one page of the Accounts page (§7.4), newest first:
 * one paged read of `GET /api/v1/invitations` with `userId` repeated (§12.1), whatever the number of
 * invited accounts (#357). A page of accounts fits the parameter's bound (`DEFAULT_PAGE_LIMIT` ≤
 * `MAX_TICKET_FILTER_VALUES`). It is keyed by all the accounts of the page, not only those with
 * invitations, so revoking an account's last one keeps the key: the refetch of the accounts reuses
 * the read the invalidation started. Each row selects its own account's invitations. A `4xx` is an
 * answer, not a failure to retry: retrying a `429` would only use up more of the limit (#356).
 */
export function accountsInvitationsQueryOptions(client: ApiClient, accounts: readonly User[]) {
  const userId = accounts.map(({ id }) => id);
  return queryOptions({
    queryKey: ['invitations', 'list', { userId }],
    queryFn: ({ signal }) =>
      allPageItems((cursor) =>
        dataOf(
          client.GET('/api/v1/invitations', {
            params: {
              query: { userId, limit: MAX_PAGE_LIMIT, ...(cursor === null ? {} : { cursor }) },
            },
            signal,
          }),
        ),
      ),
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 3,
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
