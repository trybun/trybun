'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { ORGANIZATION_MAX_PROJECTS, type Organization } from '@trybun/contracts/organizations';
import { Badge } from '@trybun/ui/components/badge';
import { Button } from '@trybun/ui/components/button';
import { Field, FieldLabel } from '@trybun/ui/components/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@trybun/ui/components/select';
import { toast } from '@trybun/ui/components/toast';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { projectsQueryOptions } from '../../projects/queries.js';
import { useUpdateOrganization } from '../mutations.js';
import { OrganizationSection } from './organization-section.js';

/**
 * The projects an organization may access (§7.3): each with Remove, and a picker of the active
 * projects not yet added, both with `manage_projects`. The whole set is sent.
 */
export function OrganizationProjects({ organization }: { organization: Organization }) {
  const t = useTranslations('organizations.projects');
  const errorMessage = useErrorMessage();
  const updateOrganization = useUpdateOrganization();
  const canManage = organization.allowedActions.includes('manage_projects');
  const activeProjects = useInfiniteQuery({
    ...projectsQueryOptions(browserApiClient, 'active'),
    enabled: canManage,
  });
  const [projectId, setProjectId] = useState<string | null>(null);
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });

  const projectIds = organization.projects.map((project) => project.id);
  const candidates = (activeProjects.data?.pages.flatMap((page) => page.items) ?? []).filter(
    (project) => !projectIds.includes(project.id),
  );
  const chosen = candidates.find((project) => project.id === projectId);

  const change = (ids: string[], message: string, onSuccess?: () => void) =>
    updateOrganization.mutate(
      { organization, input: { projectIds: ids } },
      {
        onSuccess: () => {
          toast.add({ title: message, type: 'success' });
          onSuccess?.();
        },
        onError: showError,
      },
    );

  return (
    <OrganizationSection
      id="organization-projects-title"
      title={t('title')}
      description={t('description')}
      tourTarget="organization-detail-projects"
    >
      {organization.projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {organization.projects.map((project) => (
            <li
              key={project.id}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-border bg-card px-3 py-1.5 text-card-foreground"
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate font-medium">{project.name}</span>
                <Badge variant="outline" className="font-mono">
                  {project.key}
                </Badge>
                {project.state === 'archived' && <Badge variant="outline">{t('archived')}</Badge>}
              </span>
              {/* The access to an archived project can be neither granted nor removed (§7.3). */}
              {canManage && project.state === 'active' && (
                <Button
                  variant="outline"
                  aria-label={t('removeOf', { name: project.name })}
                  disabled={updateOrganization.isPending}
                  onClick={() =>
                    change(
                      projectIds.filter((id) => id !== project.id),
                      t('removed', { name: project.name }),
                    )
                  }
                >
                  {t('remove')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage && projectIds.length < ORGANIZATION_MAX_PROJECTS && (
        <div className="flex flex-col gap-3">
          {activeProjects.isSuccess && candidates.length === 0 && !activeProjects.hasNextPage ? (
            <p className="text-sm text-muted-foreground">{t('noCandidates')}</p>
          ) : (
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <Field className="md:flex-1">
                <FieldLabel>{t('project')}</FieldLabel>
                <Select
                  items={candidates.map((project) => ({
                    value: project.id,
                    label: `${project.name} (${project.key})`,
                  }))}
                  value={chosen === undefined ? null : chosen.id}
                  onValueChange={(value) => setProjectId(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('choose')} />
                  </SelectTrigger>
                  <SelectContent>
                    {candidates.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name} ({project.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Button
                className="w-full md:w-fit"
                disabled={chosen === undefined || updateOrganization.isPending}
                onClick={() => {
                  if (chosen !== undefined) {
                    change([...projectIds, chosen.id], t('added', { name: chosen.name }), () =>
                      setProjectId(null),
                    );
                  }
                }}
              >
                <PlusIcon aria-hidden />
                {updateOrganization.isPending ? t('adding') : t('add')}
              </Button>
            </div>
          )}
          {activeProjects.hasNextPage && (
            <Button
              variant="outline"
              className="w-full md:w-fit"
              disabled={activeProjects.isFetchingNextPage}
              onClick={() => void activeProjects.fetchNextPage()}
            >
              {t('loadMore')}
            </Button>
          )}
        </div>
      )}
    </OrganizationSection>
  );
}
