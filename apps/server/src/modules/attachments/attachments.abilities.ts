import { subject } from '@casl/ability';
import { type AttachmentAction, attachmentActionSchema } from '@trybun/contracts/attachments';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../../platform/authentication/principal.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';
import {
  memberFrom,
  ticketChangeConditions,
  ticketReadConditions,
  ticketRuleSelect,
} from '../tickets/tickets.abilities.js';

/** The subject of the attachments (§18.3). */
export const ATTACHMENT = 'Attachment';

/** Uploading files, a global action of the account (§13.3). */
export const CREATE = 'create';

/** The contract's closed list (§18.3): an action added to it is restricted by default. */
const ALL_ACTIONS = attachmentActionSchema.options;

/** The actions an archived project still allows on the attachments of its tickets (§7.3). */
const ACTIONS_OF_ARCHIVED_PROJECTS: readonly AttachmentAction[] = ['read'];

/**
 * The rules of attachments (§7.5): every account uploads files, and a draft belongs to its
 * uploader alone – nobody else, not even the Administrator, sees it (§13.3). A linked attachment
 * is read by everyone who reads its ticket; its uploader deletes it under the conditions of adding
 * attachments to the ticket (Q14), a Developer, Project manager and the Administrator delete any.
 */
export const attachmentsAbilities: AbilityRules = ({ can }, principal) => {
  can(CREATE, ATTACHMENT);
  can(['read', 'delete'], ATTACHMENT, { ticketId: null, uploadedById: principal.userId });
  if (principal.userKind !== 'end_user' && principal.isAdmin) {
    can(['read', 'delete'], ATTACHMENT, { ticketId: { not: null } });
    return;
  }
  // `is`: the in-memory check of a record supports a to-one relation only in this form.
  can('read', ATTACHMENT, { ticket: { is: ticketReadConditions(principal) } });
  for (const conditions of ticketChangeConditions(principal)) {
    can('delete', ATTACHMENT, { uploadedById: principal.userId, ticket: { is: conditions } });
  }
  if (principal.userKind === 'team') {
    can('delete', ATTACHMENT, {
      ticket: { is: { project: { is: memberFrom(principal, 'developer') } } },
    });
  }
};

/**
 * A global restriction (§18.3), added after every rule: the attachments of the tickets of an
 * archived project are read-only for everyone, the Administrator included (§7.5); reading and
 * downloading stay allowed. Drafts belong to no project and are not restricted. Its reason makes
 * the API answer `409 project.archived` instead of `403`.
 */
export const archivedProjectsOfAttachmentsRestriction: AbilityRules = ({ cannot }) => {
  cannot(
    ALL_ACTIONS.filter((action) => !ACTIONS_OF_ARCHIVED_PROJECTS.includes(action)),
    ATTACHMENT,
    { ticket: { is: { project: { is: { state: 'archived' } } } } },
  ).because('project.archived');
};

/**
 * The fields of an attachment its rules read (§18.3): its uploader, whether it is linked and, of
 * its ticket, the fields the ticket's rules read.
 */
export function attachmentRuleSelect(principal: Principal) {
  return {
    id: true,
    uploadedById: true,
    ticketId: true,
    ticket: { select: ticketRuleSelect(principal) },
  } satisfies Prisma.AttachmentSelect;
}

/** How the record access loads an attachment (§18.3). */
export const attachmentRecords: RecordDescriptor<'Attachment'> = {
  subject: ATTACHMENT,
  async find(db, where, principal) {
    const row = await db.attachment.findFirst({ where, select: attachmentRuleSelect(principal) });
    return row === null ? null : subject(ATTACHMENT, row);
  },
};
