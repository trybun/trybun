'use client';

import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  type Project,
  type ProjectMember,
  type ProjectRole,
  projectRoleSchema,
} from '@trybun/contracts/projects';
import { Button } from '@trybun/ui/components/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { toast } from '@trybun/ui/components/toast';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useChangeProjectMemberRole, useRemoveProjectMember } from '../mutations.js';
import { projectMembersQueryOptions, projectRoleCountQueryOptions } from '../queries.js';
import { LazyAddMemberDialog } from './lazy-add-member-dialog.js';
import { LazyConfirmDialog } from './lazy-confirm-dialog.js';

/** A change of a member that needs a confirmation first. */
type PendingChange = { kind: 'remove' | 'demote'; member: ProjectMember };

/**
 * The Members tab (§7.4): every member with display name, GitHub login and role; with
 * `manage_members` also Add member, a role selector and Remove per row. Removing or demoting the
 * last Project manager is confirmed with the warning of §7.4.
 */
export function ProjectMembers({ project }: { project: Project }) {
  const t = useTranslations('projects');
  const errorMessage = useErrorMessage();
  const canManage = project.allowedActions.includes('manage_members');
  const members = useInfiniteQuery(projectMembersQueryOptions(browserApiClient, project.id));
  const managerCount = useQuery({
    ...projectRoleCountQueryOptions(browserApiClient, project.id, 'project_manager'),
    enabled: canManage,
  });
  const changeRole = useChangeProjectMemberRole(project.id);
  const removeMember = useRemoveProjectMember(project.id);
  const [pending, setPending] = useState<PendingChange | null>(null);

  const nameOf = (member: ProjectMember) =>
    member.user.displayName ?? member.user.githubLogin ?? t('members.noName');
  const isLastManager = (member: ProjectMember) =>
    member.role === 'project_manager' && (managerCount.data ?? 0) <= 1;
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });

  const applyRole = (member: ProjectMember, role: ProjectRole) =>
    changeRole.mutate({ userId: member.user.id, role }, { onError: showError });

  const requestRole = (member: ProjectMember, role: ProjectRole) => {
    if (role === member.role) {
      return;
    }
    if (role === 'developer' && isLastManager(member)) {
      setPending({ kind: 'demote', member });
      return;
    }
    applyRole(member, role);
  };

  const confirm = (change: PendingChange) => {
    if (change.kind === 'demote') {
      applyRole(change.member, 'developer');
      setPending(null);
      return;
    }
    removeMember.mutate(change.member.user.id, {
      onSuccess: () => {
        toast.add({
          title: t('members.removed', { name: nameOf(change.member) }),
          type: 'success',
        });
        setPending(null);
      },
      onError: showError,
    });
  };

  if (members.isError) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errorMessage(members.error)}
      </p>
    );
  }
  const items = members.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <section aria-labelledby="project-members-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 id="project-members-title" className="text-lg font-semibold">
          {t('members.title')}
        </h2>
        {canManage && <LazyAddMemberDialog projectId={project.id} />}
      </div>
      {members.isSuccess && items.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('members.empty')}</p>
      )}
      <ul className="flex flex-col gap-2">
        {items.map((member) => (
          <li
            key={member.user.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground md:flex-row md:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{nameOf(member)}</span>
              {member.user.githubLogin !== null && (
                <span className="truncate text-sm text-muted-foreground">
                  @{member.user.githubLogin}
                </span>
              )}
            </div>
            {canManage ? (
              <div className="flex gap-2">
                <Select
                  items={projectRoleSchema.options.map((value) => ({
                    value,
                    label: t(`roles.${value}`),
                  }))}
                  value={member.role}
                  disabled={changeRole.isPending && changeRole.variables.userId === member.user.id}
                  onValueChange={(value) => requestRole(member, projectRoleSchema.parse(value))}
                >
                  <SelectTrigger
                    className="flex-1 md:w-48"
                    aria-label={t('members.roleOf', { name: nameOf(member) })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {projectRoleSchema.options.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`roles.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  aria-label={t('members.removeOf', { name: nameOf(member) })}
                  onClick={() => setPending({ kind: 'remove', member })}
                >
                  {t('members.remove')}
                </Button>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">{t(`roles.${member.role}`)}</span>
            )}
          </li>
        ))}
      </ul>
      {members.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={members.isFetchingNextPage}
          onClick={() => void members.fetchNextPage()}
        >
          {members.isFetchingNextPage ? t('list.loadingMore') : t('list.loadMore')}
        </Button>
      )}
      {pending !== null && (
        <LazyConfirmDialog
          title={
            pending.kind === 'remove'
              ? t('members.removeTitle', { name: nameOf(pending.member) })
              : t('members.demoteTitle', { name: nameOf(pending.member) })
          }
          description={isLastManager(pending.member) ? t('members.lastManagerWarning') : undefined}
          confirmLabel={
            pending.kind === 'remove' ? t('members.removeConfirm') : t('members.demoteConfirm')
          }
          cancelLabel={t('members.cancel')}
          isDestructive={pending.kind === 'remove'}
          isPending={removeMember.isPending}
          onConfirm={() => confirm(pending)}
          onClose={() => setPending(null)}
        />
      )}
    </section>
  );
}
