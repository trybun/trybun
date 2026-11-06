import { subject } from '@casl/ability';
import { type ProjectAction, projectActionSchema } from '@trybun/contracts/projects';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../../platform/authentication/principal.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';

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

/** The contract's closed list (§18.3): an action added to it is restricted by default. */
const ALL_ACTIONS = projectActionSchema.options;

/**
 * The rules of projects (§7.5): the Administrator creates and manages every project; a team member
 * sees the projects they belong to and, as Project manager, changes the settings and the members;
 * an end user sees the projects of their personal access and of their active organization (§7.1,
 * §7.3).
 */
export const projectsAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.userKind === 'end_user') {
    can('read', PROJECT, {
      members: { some: { userId: principal.userId, role: 'end_user' } },
    });
    // `is`: the in-memory check of a record supports a to-one relation only in this form.
    can('read', PROJECT, {
      organizations: {
        some: {
          organization: {
            is: { state: 'active', members: { some: { userId: principal.userId } } },
          },
        },
      },
    });
    return;
  }
  if (principal.isAdmin) {
    can(CREATE, PROJECT);
    can([...ALL_ACTIONS], PROJECT);
    return;
  }
  // Only team roles count: a membership that contradicts the account kind grants nothing (§7.1).
  can(['read', 'read_members'], PROJECT, {
    members: { some: { userId: principal.userId, role: { in: teamRolesFrom('developer') } } },
  });
  can(['update_settings', 'manage_members'], PROJECT, {
    members: {
      some: { userId: principal.userId, role: { in: teamRolesFrom('project_manager') } },
    },
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

/**
 * The fields of a project its rules read (§18.3): its state, the principal's own membership and
 * the access of the principal's organization – at most one, as an end user belongs to at most one
 * organization (§7.3).
 */
export function projectRuleSelect(principal: Principal) {
  return {
    id: true,
    state: true,
    members: { where: { userId: principal.userId }, select: { userId: true, role: true } },
    organizations: {
      where: { organization: { members: { some: { userId: principal.userId } } } },
      select: {
        organization: {
          select: {
            state: true,
            members: { where: { userId: principal.userId }, select: { userId: true } },
          },
        },
      },
    },
  } satisfies Prisma.ProjectSelect;
}

/** How the record access loads a project (§18.3). */
export const projectRecords: RecordDescriptor<'Project'> = {
  subject: PROJECT,
  async find(db, where, principal) {
    const row = await db.project.findFirst({ where, select: projectRuleSelect(principal) });
    return row === null ? null : subject(PROJECT, row);
  },
};
