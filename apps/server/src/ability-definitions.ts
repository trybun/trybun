import { administrationAbilities } from './modules/administration/administration.abilities.js';
import {
  archivedTargetsOfInvitationsRestriction,
  invitationRecords,
  invitationsAbilities,
} from './modules/invitations/invitations.abilities.js';
import {
  archivedOrganizationsRestriction,
  organizationRecords,
  organizationsAbilities,
} from './modules/organizations/organizations.abilities.js';
import {
  archivedProjectsRestriction,
  projectRecords,
  projectsAbilities,
} from './modules/projects/projects.abilities.js';
import { userRecords, usersAbilities } from './modules/users/users.abilities.js';

/**
 * The permission layer of the API (§18.3): the rules of the feature modules, the global
 * restrictions added after them and the record descriptors of the subjects with records, passed
 * to `AuthorizationModule.forRoot()` by the root module and by the integration tests.
 */
export const ABILITY_DEFINITIONS = {
  rules: [
    administrationAbilities,
    projectsAbilities,
    organizationsAbilities,
    invitationsAbilities,
    usersAbilities,
  ],
  restrictions: [
    archivedProjectsRestriction,
    archivedOrganizationsRestriction,
    archivedTargetsOfInvitationsRestriction,
  ],
  records: [projectRecords, organizationRecords, invitationRecords, userRecords],
};
