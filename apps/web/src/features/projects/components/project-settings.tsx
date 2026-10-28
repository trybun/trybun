'use client';

import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@trybun/ui/components/alert';
import { Badge } from '@trybun/ui/components/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@trybun/ui/components/tabs';
import { ArchiveIcon, ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import { notFound, useRouter } from 'next/navigation.js';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { projectQueryOptions } from '../queries.js';
import {
  type ProjectSettingsTab,
  projectSettingsHref,
  projectSettingsTabSchema,
} from '../search-params.js';
import { ProjectDangerZone } from './project-danger-zone.js';
import { ProjectGeneralForm } from './project-general-form.js';
import { ProjectMembers } from './project-members.js';
import { ProjectOrganizations } from './project-organizations.js';

/**
 * The project settings (§3.1, §7.3, §7.4): the General, Members and Danger zone tabs, shown by
 * the project's `allowedActions` (§18.5); the tab is URL state. An archived project shows a
 * banner and offers only reading and unarchiving. The Administrator also sees the organizations
 * with access on the General tab.
 */
export function ProjectSettings({
  projectId,
  tab,
  canSeeOrganizations = false,
}: {
  projectId: string;
  tab: ProjectSettingsTab;
  /** Whether the person administers organizations (`create_organization`, §7.5). */
  canSeeOrganizations?: boolean;
}) {
  const t = useTranslations('projects');
  const router = useRouter();
  const { data: project, error } = useQuery(projectQueryOptions(browserApiClient, projectId));
  // The project became invisible, e.g. a Project manager removed themselves from it.
  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }
  if (project === undefined) {
    return null;
  }
  const can = (action: (typeof project.allowedActions)[number]) =>
    project.allowedActions.includes(action);
  const tabs = projectSettingsTabSchema.options.filter(
    (value) =>
      value === 'general' ||
      (value === 'members' && can('read_members')) ||
      (value === 'danger' && (can('archive') || can('unarchive') || can('delete'))),
  );
  const current = tabs.includes(tab) ? tab : 'general';

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href="/projects"
          className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring focus-visible:outline-none xl:pointer-fine:min-h-0"
        >
          <ChevronLeftIcon aria-hidden className="size-4" />
          {t('settings.back')}
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold break-words">{project.name}</h1>
          <Badge variant="outline" className="font-mono">
            {project.key}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{t('settings.title')}</p>
      </div>
      {project.state === 'archived' && (
        <Alert variant="warning">
          <ArchiveIcon aria-hidden />
          <AlertDescription>{t('archivedBanner')}</AlertDescription>
        </Alert>
      )}
      <Tabs
        value={current}
        onValueChange={(value) =>
          router.replace(projectSettingsHref(project.id, projectSettingsTabSchema.parse(value)), {
            scroll: false,
          })
        }
      >
        <TabsList aria-label={t('settings.tabs.label')}>
          {tabs.map((value) => (
            <TabsTrigger key={value} value={value}>
              {t(`settings.tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="general" className="flex flex-col gap-8 pt-4">
          <ProjectGeneralForm key={project.version} project={project} />
          {canSeeOrganizations && <ProjectOrganizations projectId={project.id} />}
        </TabsContent>
        {tabs.includes('members') && (
          <TabsContent value="members" className="pt-4">
            <ProjectMembers project={project} />
          </TabsContent>
        )}
        {tabs.includes('danger') && (
          <TabsContent value="danger" className="pt-4">
            <ProjectDangerZone project={project} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
