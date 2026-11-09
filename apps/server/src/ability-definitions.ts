import {
  archivedProjectsOfAttachmentsRestriction,
  attachmentRecords,
  attachmentsAbilities,
} from './modules/attachments/attachments.abilities.js';
import { administrationAbilities } from './modules/administration/administration.abilities.js';
import {
  archivedProjectsOfCommentsRestriction,
  commentRecords,
  commentsAbilities,
} from './modules/comments/comments.abilities.js';
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
import {
  archivedProjectsOfTicketsRestriction,
  ticketRecords,
  ticketsAbilities,
} from './modules/tickets/tickets.abilities.js';
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
    ticketsAbilities,
    attachmentsAbilities,
    commentsAbilities,
  ],
  restrictions: [
    archivedProjectsRestriction,
    archivedOrganizationsRestriction,
    archivedTargetsOfInvitationsRestriction,
    archivedProjectsOfTicketsRestriction,
    archivedProjectsOfAttachmentsRestriction,
    archivedProjectsOfCommentsRestriction,
  ],
  records: [
    projectRecords,
    organizationRecords,
    invitationRecords,
    userRecords,
    ticketRecords,
    attachmentRecords,
    commentRecords,
  ],
};
