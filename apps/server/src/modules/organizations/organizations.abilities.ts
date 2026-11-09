import { subject } from '@casl/ability';
import { type OrganizationAction, organizationActionSchema } from '@trybun/contracts/organizations';
import type { Prisma } from '../../generated/prisma/client.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';

/** The subject of the organizations (§18.3). */
export const ORGANIZATION = 'Organization';

/** Creating an organization, a global action of the account (`create_organization`, §18.3). */
export const CREATE = 'create';

/**
 * Reading the ID and the name of an organization for the filters of the team views (S1-13 Q6), an
 * action outside the contract's list: it is never sent in `allowedActions`.
 */
export const READ_NAME = 'read_name';

/** The contract's closed list (§18.3): an action added to it is restricted by default. */
const ALL_ACTIONS = organizationActionSchema.options;

/**
 * The actions an archived organization still allows (§7.3): reading, unarchiving and deleting it
 * while it has no tickets.
 */
const ACTIONS_OF_ARCHIVED_ORGANIZATIONS: readonly OrganizationAction[] = [
  'read',
  'unarchive',
  'delete',
];

/**
 * The rules of organizations (§7.5): only the Administrator sees, creates and manages them, their
 * e-mail domains, their projects and their members. A team member reads only the names of the
 * organizations with access to one of their projects (S1-13 Q6) – names their tickets already
 * show; for end users organizations are invisible.
 */
export const organizationsAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.userKind !== 'team') {
    return;
  }
  if (!principal.isAdmin) {
    // Only team roles count: a membership that contradicts the account kind grants nothing (§7.1).
    can(READ_NAME, ORGANIZATION, {
      projects: {
        some: {
          project: {
            is: {
              members: {
                some: { userId: principal.userId, role: { in: teamRolesFrom('developer') } },
              },
            },
          },
        },
      },
    });
    return;
  }
  can(READ_NAME, ORGANIZATION);
  can(CREATE, ORGANIZATION);
  can([...ALL_ACTIONS], ORGANIZATION);
};

/**
 * A global restriction (§18.3), added after every rule: an archived organization is read-only
 * until it is unarchived (§7.3). Its reason makes the API answer `409 organization.archived`
 * instead of `403`.
 */
export const archivedOrganizationsRestriction: AbilityRules = ({ cannot }) => {
  cannot(
    ALL_ACTIONS.filter((action) => !ACTIONS_OF_ARCHIVED_ORGANIZATIONS.includes(action)),
    ORGANIZATION,
    { state: 'archived' },
  ).because('organization.archived');
};

/** The fields of an organization its rules read (§18.3). */
export const ORGANIZATION_RULE_SELECT = {
  id: true,
  state: true,
} satisfies Prisma.OrganizationSelect;

/** How the record access loads an organization (§18.3). */
export const organizationRecords: RecordDescriptor<'Organization'> = {
  subject: ORGANIZATION,
  async find(db, where) {
    const row = await db.organization.findFirst({ where, select: ORGANIZATION_RULE_SELECT });
    return row === null ? null : subject(ORGANIZATION, row);
  },
};
