'use client';

import type { Project } from '@trybun/contracts/projects';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldLabel } from '@trybun/ui/components/field';
import { Input } from '@trybun/ui/components/input';
import { toast } from '@trybun/ui/components/toast';
import { useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { type ReactNode, useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useArchiveProject, useDeleteProject, useUnarchiveProject } from '../mutations.js';
import { LazyConfirmDialog } from './lazy-confirm-dialog.js';

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
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * The Danger zone of the project settings (§7.3), for the Administrator: archive – with Undo
 * instead of a confirmation (Rule 2) – unarchive, and delete, which cannot be undone and is
 * confirmed by typing the key, following GitHub's repository deletion.
 */
export function ProjectDangerZone({ project }: { project: Project }) {
  const t = useTranslations('projects.danger');
  const tTabs = useTranslations('projects.settings.tabs');
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const archive = useArchiveProject();
  const unarchive = useUnarchiveProject();
  const deleteProject = useDeleteProject();
  const [isDeleting, setIsDeleting] = useState(false);
  const [typedKey, setTypedKey] = useState('');
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });
  const can = (action: Project['allowedActions'][number]) =>
    project.allowedActions.includes(action);

  const archiveProject = () =>
    archive.mutate(project, {
      onSuccess: (archived) =>
        toast.add({
          title: t('archived'),
          type: 'success',
          actionProps: {
            children: t('undo'),
            onClick: () => unarchive.mutate(archived, { onError: showError }),
          },
        }),
      onError: showError,
    });

  return (
    <section aria-labelledby="project-danger-title" className="flex flex-col gap-4">
      <h2 id="project-danger-title" className="text-lg font-semibold">
        {tTabs('danger')}
      </h2>
      {can('archive') && (
        <DangerAction title={t('archive')} description={t('archiveDescription')}>
          <Button variant="outline" disabled={archive.isPending} onClick={archiveProject}>
            {t('archive')}
          </Button>
        </DangerAction>
      )}
      {can('unarchive') && project.state === 'archived' && (
        <DangerAction title={t('unarchive')} description={t('unarchiveDescription')}>
          <Button
            variant="outline"
            disabled={unarchive.isPending}
            onClick={() =>
              unarchive.mutate(project, {
                onSuccess: () => toast.add({ title: t('unarchived'), type: 'success' }),
                onError: showError,
              })
            }
          >
            {t('unarchive')}
          </Button>
        </DangerAction>
      )}
      {(can('delete') || (project.state === 'archived' && can('unarchive'))) && (
        <DangerAction
          title={t('delete')}
          description={can('delete') ? t('deleteDescription') : t('deleteArchived')}
        >
          <Button
            variant="destructive"
            disabled={!can('delete')}
            onClick={() => setIsDeleting(true)}
          >
            {t('delete')}
          </Button>
        </DangerAction>
      )}
      {isDeleting && (
        <LazyConfirmDialog
          title={t('deleteTitle', { name: project.name })}
          description={t('deleteDescription')}
          confirmLabel={deleteProject.isPending ? t('deleting') : t('deleteConfirm')}
          cancelLabel={t('cancel')}
          isDestructive
          isPending={deleteProject.isPending}
          isConfirmDisabled={typedKey !== project.key}
          onConfirm={() =>
            deleteProject.mutate(project, {
              onSuccess: () => {
                toast.add({ title: t('deleted'), type: 'success' });
                router.push('/projects');
              },
              onError: showError,
            })
          }
          onClose={() => {
            setIsDeleting(false);
            setTypedKey('');
          }}
        >
          <Field>
            <FieldLabel>{t('deleteConfirmLabel', { key: project.key })}</FieldLabel>
            <Input
              value={typedKey}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              className="font-mono"
              onChange={(event) => setTypedKey(event.target.value)}
            />
          </Field>
        </LazyConfirmDialog>
      )}
    </section>
  );
}
