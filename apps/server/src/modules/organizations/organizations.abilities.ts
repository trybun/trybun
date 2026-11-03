import type { OrganizationAction } from '@trybun/contracts/organizations';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';

/** The subject of the organizations (§18.3). */
export const ORGANIZATION = 'Organization';

/** Creating an organization, a global action of the account (`create_organization`, §18.3). */
export const CREATE = 'create';

const ALL_ACTIONS: readonly OrganizationAction[] = [
  'read',
  'update',
  'archive',
  'unarchive',
  'delete',
  'manage_projects',
  'manage_members',
];

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
 * e-mail domains, their projects and their members; for everyone else they are invisible. The
 * permission layer (S1-04) takes them over and adds read access where other features need it.
 */
export const organizationsAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.userKind !== 'team' || !principal.isAdmin) {
    return;
  }
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
