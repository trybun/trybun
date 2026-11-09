import { projectStateSchema } from '@trybun/contracts/projects';
import { z } from 'zod';

/** The URL state of the Projects page (§18.5): the tab of active or archived projects. */
export const projectsSearchParamsSchema = z.object({
  state: projectStateSchema.catch('active'),
});
export type ProjectsSearchParams = z.infer<typeof projectsSearchParamsSchema>;

/** The tabs of the project settings. */
export const projectSettingsTabSchema = z.enum(['general', 'members', 'danger']);
export type ProjectSettingsTab = z.infer<typeof projectSettingsTabSchema>;

/** The URL state of the project settings (§18.5): the open tab. */
export const projectSettingsSearchParamsSchema = z.object({
  tab: projectSettingsTabSchema.catch('general'),
});

/** The address of the settings of a project, on a tab. */
export function projectSettingsHref(projectId: string, tab?: ProjectSettingsTab): string {
  const path = `/projects/${projectId}/settings`;
  return tab === undefined || tab === 'general' ? path : `${path}?tab=${tab}`;
}
