// The rows of §7.5 about attachments (§18.3, §18.7): each with an allowed and a denied case.
import { type AttachmentAction, attachmentActionSchema } from '@trybun/contracts/attachments';
import { describe, expect, it } from 'vitest';
import {
  buildAttachmentRecord,
  buildPrincipal,
  PRINCIPAL_FIXTURES,
  type PrincipalFixture,
  type TicketRecordOptions,
} from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedProjectsOfTicketsRestriction,
  ticketsAbilities,
} from '../tickets/tickets.abilities.js';
import {
  ATTACHMENT,
  archivedProjectsOfAttachmentsRestriction,
  attachmentsAbilities,
  CREATE,
} from './attachments.abilities.js';

const abilities = new AbilityFactory(
  [ticketsAbilities, attachmentsAbilities],
  [archivedProjectsOfTicketsRestriction, archivedProjectsOfAttachmentsRestriction],
);

type RecordOptions = Parameters<typeof buildAttachmentRecord>[1];

function can(who: PrincipalFixture, action: AttachmentAction, options: RecordOptions = {}) {
  return abilities
    .forPrincipal(buildPrincipal(who))
    .can(action, buildAttachmentRecord(who, options));
}

function allowedActions(who: PrincipalFixture, options: RecordOptions) {
  return attachmentActionSchema.options.filter((action) => can(who, action, options));
}

const OWN_TICKET: TicketRecordOptions = { own: true };
const OTHER_TICKET: TicketRecordOptions = { own: false };

describe('attachment abilities', () => {
  it.each(PRINCIPAL_FIXTURES)('lets %s upload files', (who) => {
    expect(abilities.forPrincipal(buildPrincipal(who)).can(CREATE, ATTACHMENT)).toBe(true);
  });

  // Drafts belong to the uploader alone (§13.3): nobody else, not even the Administrator.
  it.each(PRINCIPAL_FIXTURES)('gives %s its own drafts and no other draft', (who) => {
    expect(allowedActions(who, { own: true, ticket: null })).toEqual(['read', 'delete']);
    expect(allowedActions(who, { own: false, ticket: null })).toEqual([]);
  });

  it.each([
    ["Viewing a ticket's attachments", 'read', 'end_user_personal', false, OWN_TICKET, true],
    ["Viewing a ticket's attachments", 'read', 'end_user_personal', false, OTHER_TICKET, false],
    // A requester keeps reading their tickets after losing access to the project (§7.3).
    ["Viewing a ticket's attachments", 'read', 'end_user', false, OWN_TICKET, true],
    ["Viewing a ticket's attachments", 'read', 'developer', false, OTHER_TICKET, true],
    ["Viewing a ticket's attachments", 'read', 'admin', false, OTHER_TICKET, true],
    ["Viewing a ticket's attachments", 'read', 'team_member', true, OTHER_TICKET, false],
    ['Delete own attachments', 'delete', 'end_user_personal', true, OWN_TICKET, true],
    ['Delete own attachments', 'delete', 'end_user_organization', true, OWN_TICKET, true],
    ['Delete own attachments', 'delete', 'end_user_personal', false, OWN_TICKET, false],
    // Without current access to the project a requester only reads (Q14).
    ['Delete own attachments', 'delete', 'end_user', true, OWN_TICKET, false],
    ['Delete own attachments', 'delete', 'end_user_archived_organization', true, OWN_TICKET, false],
    ['Delete own attachments', 'delete', 'end_user_personal', true, OTHER_TICKET, false],
    ['Delete own attachments', 'delete', 'team_member', true, OTHER_TICKET, false],
    ['Delete any attachment', 'delete', 'developer', false, OTHER_TICKET, true],
    ['Delete any attachment', 'delete', 'project_manager', false, OTHER_TICKET, true],
    ['Delete any attachment', 'delete', 'admin', false, OTHER_TICKET, true],
    ['Delete any attachment', 'delete', 'team_member', false, OTHER_TICKET, false],
  ] as const)(
    '%s (%s) – %s, own: %s, ticket %o: %s',
    (_row, action, who, own, ticket, isAllowed) => {
      expect(can(who, action, { own, ticket })).toBe(isAllowed);
    },
  );

  it.each(['active', 'archived'] as const)(
    'holds the hierarchy on an %s project: Developer ⊆ Project manager ⊆ Administrator (§7.2)',
    (state) => {
      for (const isOwn of [true, false]) {
        const options = { own: isOwn, ticket: { state } };
        for (const action of attachmentActionSchema.options) {
          if (can('developer', action, options)) {
            expect(can('project_manager', action, options), action).toBe(true);
          }
          if (can('project_manager', action, options)) {
            expect(can('admin', action, options), action).toBe(true);
          }
        }
      }
    },
  );

  it('grants a team account nothing of the end-user rows, even on a ticket it requested (§7.1)', () => {
    expect(allowedActions('team_member', { own: true, ticket: OWN_TICKET })).toEqual([]);
  });

  it.each(PRINCIPAL_FIXTURES)(
    'refuses %s every change of an attachment of an archived project with project.archived',
    (who) => {
      const ability = abilities.forPrincipal(buildPrincipal(who));
      const record = buildAttachmentRecord(who, {
        own: true,
        ticket: { own: true, state: 'archived' },
      });

      for (const action of attachmentActionSchema.options.filter((a) => a !== 'read')) {
        expect(ability.can(action, record), action).toBe(false);
        if (ability.can('read', record)) {
          expect(reasonCode(ability.relevantRuleFor(action, record)?.reason), action).toBe(
            'project.archived',
          );
        }
      }
    },
  );

  it('keeps reading the attachments of an archived project', () => {
    expect(can('developer', 'read', { ticket: { state: 'archived' } })).toBe(true);
    expect(can('end_user_personal', 'read', { ticket: { own: true, state: 'archived' } })).toBe(
      true,
    );
  });

  it('denies an end user deleting the attachment of another person with 403', () => {
    const ability = abilities.forPrincipal(buildPrincipal('end_user_personal'));
    const record = buildAttachmentRecord('end_user_personal', { own: false, ticket: OWN_TICKET });

    expect(ability.can('read', record)).toBe(true);
    expect(reasonCode(ability.relevantRuleFor('delete', record)?.reason)).toBe('request.forbidden');
  });
});
