'use client';

import type { Organization } from '@trybun/contracts/organizations';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { useArchiveOrganization, useDeleteOrganization } from '../mutations.js';
import { ORGANIZATIONS_HREF } from '../search-params.js';
import { OrganizationSection } from './organization-section.js';
import { useUnarchive } from './use-unarchive.js';

function DangerAction({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 md:flex-row md:items-center">
      <div className="flex flex-1 flex-col gap-1">
        <h4 className="font-medium">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * The Danger zone of an organization (§7.3), as the one of projects: archive – with Undo instead
 * of a confirmation (Rule 2) – and delete, which cannot be undone and is confirmed. Unarchiving is
 * offered by the banner of an archived organization.
 */
export function OrganizationDangerZone({ organization }: { organization: Organization }) {
  const t = useTranslations('organizations.danger');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const archive = useArchiveOrganization();
  const unarchive = useUnarchive();
  const deleteOrganization = useDeleteOrganization();
  const [isDeleting, setIsDeleting] = useState(false);
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });
  const can = (action: Organization['allowedActions'][number]) =>
    organization.allowedActions.includes(action);

  if (!can('archive') && !can('delete')) {
    return null;
  }
  const archiveOrganization = () =>
    archive.mutate(organization, {
      onSuccess: (archived) =>
        toast.add({
          title: t('archived'),
          type: 'success',
          actionProps: { children: t('undo'), onClick: () => unarchive(archived) },
        }),
      onError: showError,
    });

  return (
    <OrganizationSection id="organization-danger-title" title={t('title')}>
      {can('archive') && (
        <DangerAction title={t('archive')} description={t('archiveDescription')}>
          <Button variant="outline" disabled={archive.isPending} onClick={archiveOrganization}>
            {t('archive')}
          </Button>
        </DangerAction>
      )}
      {can('delete') && (
        <DangerAction title={t('delete')} description={t('deleteDescription')}>
          <Button variant="destructive" onClick={() => setIsDeleting(true)}>
            {t('delete')}
          </Button>
        </DangerAction>
      )}
      {isDeleting && (
        <LazyConfirmDialog
          title={t('deleteTitle', { name: organization.name })}
          description={t('deleteDescription')}
          confirmLabel={deleteOrganization.isPending ? t('deleting') : t('deleteConfirm')}
          cancelLabel={t('cancel')}
          isDestructive
          isPending={deleteOrganization.isPending}
          onConfirm={() =>
            deleteOrganization.mutate(organization, {
              onSuccess: () => {
                toast.add({ title: t('deleted'), type: 'success' });
                router.push(ORGANIZATIONS_HREF);
              },
              onError: showError,
            })
          }
          onClose={() => setIsDeleting(false)}
        />
      )}
    </OrganizationSection>
  );
}
