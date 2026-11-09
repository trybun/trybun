// The rows of §7.5 about comments (§18.3, §18.7): each with an allowed and a denied case.
import { type CommentAction, commentActionSchema } from '@trybun/contracts/comments';
import { describe, expect, it } from 'vitest';
import {
  buildAttachmentRecord,
  buildCommentRecord,
  buildPrincipal,
  buildTicketRecord,
  type CommentRecordOptions,
  PRINCIPAL_FIXTURES,
  type PrincipalFixture,
  type TicketRecordOptions,
} from '../../../test/factories/principal.factory.js';
import { FixedClock } from '../../../test/fixed-clock.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedProjectsOfAttachmentsRestriction,
  attachmentsAbilities,
} from '../attachments/attachments.abilities.js';
import {
  archivedProjectsOfTicketsRestriction,
  COMMENTS_CLOSE_AFTER_MS,
  ticketsAbilities,
} from '../tickets/tickets.abilities.js';
import { archivedProjectsOfCommentsRestriction, commentsAbilities } from './comments.abilities.js';

const NOW = new Date('2026-11-09T10:00:00.000Z');

const abilities = new AbilityFactory(
  [ticketsAbilities, attachmentsAbilities, commentsAbilities],
  [
    archivedProjectsOfTicketsRestriction,
    archivedProjectsOfAttachmentsRestriction,
    archivedProjectsOfCommentsRestriction,
  ],
  new FixedClock(NOW),
);

function can(who: PrincipalFixture, action: CommentAction, options: CommentRecordOptions = {}) {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, buildCommentRecord(who, options));
}

function allowedActions(who: PrincipalFixture, options: CommentRecordOptions) {
  return commentActionSchema.options.filter((action) => can(who, action, options));
}

function canOnTicket(who: PrincipalFixture, action: string, options: TicketRecordOptions) {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, buildTicketRecord(who, options));
}

const OWN_TICKET: TicketRecordOptions = { own: true };
const COLLEAGUE_TICKET: TicketRecordOptions = {
  visibility: 'my_organization',
  organization: 'mine',
};
const SHARED_TICKET: TicketRecordOptions = { visibility: 'all_customers' };
const DAY_MS = 24 * 60 * 60 * 1000;

describe('comment abilities', () => {
  describe('View other people’s tickets according to visibility and comment audience', () => {
    it('lets the team read every comment and note of its tickets, and nobody else’s', () => {
      for (const kind of ['public', 'internal'] as const) {
        expect(can('developer', 'read', { kind })).toBe(true);
        expect(can('admin', 'read', { kind })).toBe(true);
        expect(can('team_member', 'read', { kind })).toBe(false);
      }
    });

    it('never lets an end user read an internal note, even of their own ticket (§6.1)', () => {
      expect(can('end_user_personal', 'read', { kind: 'internal', ticket: OWN_TICKET })).toBe(
        false,
      );
      expect(
        can('end_user_personal', 'read', { kind: 'internal', own: true, ticket: OWN_TICKET }),
      ).toBe(false);
    });

    it.each([
      [
        'the requester an only_me comment of their ticket',
        'end_user_personal',
        { audience: 'only_me', ticket: OWN_TICKET },
        true,
      ],
      [
        'someone else an only_me comment',
        'end_user_organization',
        { audience: 'only_me', ticket: COLLEAGUE_TICKET },
        false,
      ],
      [
        'a member a my_organization comment of their organization',
        'end_user_organization',
        { audience: 'my_organization', ticket: COLLEAGUE_TICKET },
        true,
      ],
      [
        'a non-member a my_organization comment of another organization',
        'end_user_organization',
        { audience: 'my_organization', audienceOrganization: 'other', ticket: SHARED_TICKET },
        false,
      ],
      [
        'a customer an all_customers comment of a shared ticket',
        'end_user_organization',
        { audience: 'all_customers', ticket: SHARED_TICKET },
        true,
      ],
      [
        'a customer without access to the project a shared comment',
        'end_user',
        { audience: 'all_customers', ticket: SHARED_TICKET },
        false,
      ],
      [
        'the author their comment outside the audience (§5.2)',
        'end_user_organization',
        {
          own: true,
          audience: 'my_organization',
          audienceOrganization: 'other',
          ticket: SHARED_TICKET,
        },
        true,
      ],
    ] as const)('lets %s: %s', (_case, who, options, expected) => {
      expect(can(who, 'read', options)).toBe(expected);
    });
  });

  describe('Add public comments to visible tickets (terminal tickets: §4.3)', () => {
    it.each([
      ['an open ticket', { own: true }, true],
      [
        'a done ticket closed 13 days ago',
        { own: true, status: 'done', closedAt: new Date(NOW.getTime() - 13 * DAY_MS) },
        true,
      ],
      [
        'a done ticket closed 14 days ago',
        { own: true, status: 'done', closedAt: new Date(NOW.getTime() - COMMENTS_CLOSE_AFTER_MS) },
        false,
      ],
      ['a rejected ticket', { own: true, status: 'rejected' }, false],
      ['a duplicate', { own: true, status: 'duplicate' }, false],
    ] as const)('lets the requester comment on %s: %s', (_case, options, expected) => {
      expect(canOnTicket('end_user_personal', 'add_comment', options)).toBe(expected);
    });

    it('refuses a closed ticket with ticket.comments_closed', () => {
      const ability = abilities.forPrincipal(buildPrincipal('end_user_personal'));
      const record = buildTicketRecord('end_user_personal', { own: true, status: 'rejected' });

      expect(reasonCode(ability.relevantRuleFor('add_comment', record)?.reason)).toBe(
        'ticket.comments_closed',
      );
    });

    it('lets the team always comment, and not an end user on a ticket they cannot read', () => {
      expect(canOnTicket('developer', 'add_comment', { status: 'rejected' })).toBe(true);
      expect(canOnTicket('end_user_personal', 'add_comment', { own: false })).toBe(false);
    });
  });

  describe('Add internal notes', () => {
    it('lets a Developer and above add notes, and no end user', () => {
      expect(canOnTicket('developer', 'add_internal_note', {})).toBe(true);
      expect(canOnTicket('admin', 'add_internal_note', {})).toBe(true);
      expect(canOnTicket('end_user_personal', 'add_internal_note', OWN_TICKET)).toBe(false);
    });
  });

  describe('Edit or delete own comments and notes', () => {
    it('lets the author edit and delete their own comment, also on a closed ticket (Q12)', () => {
      const closed = { own: true, status: 'done', closedAt: new Date(2026, 0, 1) } as const;
      expect(
        allowedActions('end_user_personal', { own: true, ticket: closed }).filter(
          (action) => action === 'update' || action === 'delete',
        ),
      ).toEqual(['update', 'delete']);
    });

    it('never lets anyone edit another person’s comment, not even the Administrator', () => {
      expect(can('end_user_personal', 'update', { ticket: OWN_TICKET })).toBe(false);
      expect(can('admin', 'update', {})).toBe(false);
      expect(can('admin', 'update', { own: true })).toBe(true);
    });
  });

  describe('Delete any comment', () => {
    it('lets a Developer delete any comment of their project, and not an end user', () => {
      expect(can('developer', 'delete', {})).toBe(true);
      expect(can('end_user_personal', 'delete', { ticket: OWN_TICKET })).toBe(false);
    });
  });

  describe('View edit history', () => {
    it('lets the team read every history and an end user only that of their own texts (Q3)', () => {
      expect(can('developer', 'read_revisions', {})).toBe(true);
      expect(can('end_user_personal', 'read_revisions', { own: true, ticket: OWN_TICKET })).toBe(
        true,
      );
      expect(can('end_user_personal', 'read_revisions', { ticket: OWN_TICKET })).toBe(false);
      expect(canOnTicket('end_user_personal', 'read_description_revisions', OWN_TICKET)).toBe(true);
      expect(
        canOnTicket('end_user_organization', 'read_description_revisions', COLLEAGUE_TICKET),
      ).toBe(false);
    });
  });

  describe('Redact a description or any comment', () => {
    it('lets a Developer and above redact, and no end user', () => {
      expect(can('developer', 'redact', {})).toBe(true);
      expect(canOnTicket('developer', 'redact_description', {})).toBe(true);
      expect(can('end_user_personal', 'redact', { own: true, ticket: OWN_TICKET })).toBe(false);
      expect(canOnTicket('end_user_personal', 'redact_description', OWN_TICKET)).toBe(false);
    });
  });

  describe('Attachments of comments (§13.3)', () => {
    it('follows the kind and the audience of the comment', () => {
      const can = (who: PrincipalFixture, action: string, comment: CommentRecordOptions) =>
        abilities
          .forPrincipal(buildPrincipal(who))
          .can(action, buildAttachmentRecord(who, { comment }));

      expect(can('end_user_personal', 'read', { ticket: OWN_TICKET })).toBe(true);
      expect(can('end_user_personal', 'read', { kind: 'internal', ticket: OWN_TICKET })).toBe(
        false,
      );
      expect(can('end_user_personal', 'delete', { own: true, ticket: OWN_TICKET })).toBe(true);
      expect(can('end_user_personal', 'delete', { ticket: OWN_TICKET })).toBe(false);
      expect(can('developer', 'delete', { kind: 'internal' })).toBe(true);
      expect(can('admin', 'read', { kind: 'internal' })).toBe(true);
    });

    it('keeps the attachments of comments of an archived project read-only', () => {
      const ability = abilities.forPrincipal(buildPrincipal('developer'));
      const record = buildAttachmentRecord('developer', {
        comment: { ticket: { state: 'archived' } },
      });

      expect(ability.can('read', record)).toBe(true);
      expect(ability.can('delete', record)).toBe(false);
      expect(reasonCode(ability.relevantRuleFor('delete', record)?.reason)).toBe(
        'project.archived',
      );
    });
  });

  it.each(PRINCIPAL_FIXTURES)(
    'refuses %s every change of a comment of an archived project with project.archived',
    (who) => {
      const ability = abilities.forPrincipal(buildPrincipal(who));
      const record = buildCommentRecord(who, {
        own: true,
        ticket: { own: true, state: 'archived' },
      });

      for (const action of commentActionSchema.options.filter(
        (a) => a !== 'read' && a !== 'read_revisions',
      )) {
        expect(ability.can(action, record), action).toBe(false);
        if (ability.can('read', record)) {
          expect(reasonCode(ability.relevantRuleFor(action, record)?.reason), action).toBe(
            'project.archived',
          );
        }
      }
    },
  );

  it.each(['active', 'archived'] as const)(
    'holds the hierarchy on an %s project: Developer ⊆ Project manager ⊆ Administrator (§7.2)',
    (state) => {
      for (const action of commentActionSchema.options) {
        const options = { ticket: { state } };
        if (can('developer', action, options)) {
          expect(can('project_manager', action, options), action).toBe(true);
        }
        if (can('project_manager', action, options)) {
          expect(can('admin', action, options), action).toBe(true);
        }
      }
    },
  );

  it('grants a team account nothing of the end-user rows, even on its own comment (§7.1)', () => {
    expect(allowedActions('team_member', { own: true })).toEqual([]);
    expect(can('team_member', 'read', { kind: 'internal' })).toBe(false);
  });
});
