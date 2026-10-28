'use client';

import type { Organization } from '@trybun/contracts/organizations';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useUnarchiveOrganization } from '../mutations.js';

/** Unarchives an organization – from its banner or as Undo of archiving – with its toasts. */
export function useUnarchive(): (organization: Pick<Organization, 'id' | 'version'>) => void {
  const t = useTranslations('organizations.danger');
  const errorMessage = useErrorMessage();
  const unarchive = useUnarchiveOrganization();
  return (organization) =>
    unarchive.mutate(organization, {
      onSuccess: () => toast.add({ title: t('unarchived'), type: 'success' }),
      onError: (error) => toast.add({ title: errorMessage(error), type: 'error' }),
    });
}
