import type { ProjectAction } from '@trybun/contracts/projects';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';

/** The subject of the projects (§18.3). */
export const PROJECT = 'Project';

/** Creating a project, a global action of the account (`create_project`, §18.3). */
export const CREATE = 'create';

/** The actions an archived project still allows: reading, and unarchiving it (§7.3). */
const ACTIONS_OF_ARCHIVED_PROJECTS: readonly ProjectAction[] = [
  'read',
  'read_members',
  'unarchive',
];

const ALL_ACTIONS: readonly ProjectAction[] = [
  'read',
  'update',
  'update_settings',
  'archive',
  'unarchive',
  'delete',
  'read_members',
  'manage_members',
];

/**
 * The rules of projects (§7.5): the Administrator creates and manages every project; a team member
 * sees the projects they belong to and, as Project manager, changes the settings and the members.
 * End users get access to projects with S1-02 and S1-03.
 */
export const projectsAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.userKind !== 'team') {
    return;
  }
  if (principal.isAdmin) {
    can(CREATE, PROJECT);
    can([...ALL_ACTIONS], PROJECT);
    return;
  }
  can(['read', 'read_members'], PROJECT, { members: { some: { userId: principal.userId } } });
  can(['update_settings', 'manage_members'], PROJECT, {
    members: { some: { userId: principal.userId, role: 'project_manager' } },
  });
};

/**
 * A global restriction (§18.3), added after every rule: an archived project is read-only for
 * everyone, the Administrator included, until it is unarchived (§7.3). Its reason makes the API
 * answer `409 project.archived` instead of `403`.
 */
export const archivedProjectsRestriction: AbilityRules = ({ cannot }) => {
  cannot(
    ALL_ACTIONS.filter((action) => !ACTIONS_OF_ARCHIVED_PROJECTS.includes(action)),
    PROJECT,
    { state: 'archived' },
  ).because('project.archived');
};
