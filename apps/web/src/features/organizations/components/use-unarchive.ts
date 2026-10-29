'use client';

import type { Organization } from '@trybun/contracts/organizations';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useUnarchiveOrganization } from '../mutations.js';

/**
 * Unarchives an organization – from its banner or as Undo of archiving – with its toasts;
 * `isPending` keeps a second tap from sending a stale version.
 */
export function useUnarchive(): {
  unarchive: (organization: Pick<Organization, 'id' | 'version'>) => void;
  isPending: boolean;
} {
  const t = useTranslations('organizations.danger');
  const errorMessage = useErrorMessage();
  const mutation = useUnarchiveOrganization();
  return {
    unarchive: (organization) =>
      mutation.mutate(organization, {
        onSuccess: () => toast.add({ title: t('unarchived'), type: 'success' }),
        onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
      }),
    isPending: mutation.isPending,
  };
}
