'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateAdministratorDto } from '@trybun/contracts/setup';
import { dataOf } from '../../lib/api-client/api-client.js';
import { browserApiClient } from '../../lib/api-client/browser-api-client.js';

/** Creates the first Administrator with the setup token (§15.6). */
export function useCreateAdministrator() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAdministratorDto) =>
      dataOf(browserApiClient.POST('/api/v1/setup/administrator', { body: input })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['setup'] }),
  });
}
