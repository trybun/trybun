'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateCurrentUserDto } from '@trybun/contracts/users';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';
import { currentUserQueryOptions } from './queries.js';

/**
 * Changes the settings of the signed-in account: the language and the time zone (§13.1) and
 * "Hide events" of the activity timeline (§4.5). The account in the cache changes at once, so a
 * toggle answers immediately, and returns to its previous state when the change fails (§18.5).
 */
export function useUpdateCurrentUser() {
  const queryClient = useQueryClient();
  const { queryKey } = currentUserQueryOptions(browserApiClient);
  return useMutation({
    mutationFn: (input: UpdateCurrentUserDto) =>
      dataOf(browserApiClient.PATCH('/api/v1/users/me', { body: input })),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      if (previous !== undefined) {
        const changes = Object.fromEntries(
          Object.entries(input).filter(([, value]) => value !== undefined),
        );
        queryClient.setQueryData(queryKey, { ...previous, ...changes });
      }
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (user) => queryClient.setQueryData(queryKey, user),
  });
}

/** A change of an account on the Accounts page (§7.4, §7.5): its action code. */
export type AccountChange = 'deactivate' | 'reactivate' | 'grant_admin' | 'revoke_admin';

/** Accounts have no version, so the changes send no `If-Match`. */
function changeAccount(change: AccountChange, userId: string): Promise<unknown> {
  const params = { params: { path: { userId } } };
  switch (change) {
    case 'deactivate':
      return dataOf(browserApiClient.POST('/api/v1/users/{userId}/deactivation', params));
    case 'reactivate':
      return dataOf(browserApiClient.POST('/api/v1/users/{userId}/reactivation', params));
    case 'grant_admin':
      return dataOf(browserApiClient.PUT('/api/v1/users/{userId}/administrator-role', params));
    case 'revoke_admin':
      return dataOf(browserApiClient.DELETE('/api/v1/users/{userId}/administrator-role', params));
  }
}

/**
 * Deactivates or reactivates an account, or grants or revokes its Administrator role; the lists
 * of accounts are refreshed afterwards, also after a refusal (e.g. `user.last_administrator`).
 */
export function useChangeAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ change, userId }: { change: AccountChange; userId: string }) =>
      changeAccount(change, userId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['users', 'list'] }),
  });
}
