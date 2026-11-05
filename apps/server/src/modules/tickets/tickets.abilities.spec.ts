// The rows of §7.5 about tickets (§18.3, §18.7): each with an allowed and a denied case.
import { type TicketAction, ticketActionSchema } from '@trybun/contracts/tickets';
import { describe, expect, it } from 'vitest';
import {
  buildPrincipal,
  buildProjectRecord,
  buildTicketRecord,
  PRINCIPAL_FIXTURES,
  type PrincipalFixture,
} from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import { archivedProjectsRestriction, projectsAbilities } from '../projects/projects.abilities.js';
import {
  archivedProjectsOfTicketsRestriction,
  CREATE_TICKET,
  ticketsAbilities,
} from './tickets.abilities.js';

const abilities = new AbilityFactory(
  [projectsAbilities, ticketsAbilities],
  [archivedProjectsRestriction, archivedProjectsOfTicketsRestriction],
);

type State = 'active' | 'archived';

function can(
  who: PrincipalFixture,
  action: TicketAction,
  options: { own?: boolean; state?: State } = {},
) {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, buildTicketRecord(who, options));
}

function canCreate(who: PrincipalFixture, state: State = 'active') {
  return abilities
    .forPrincipal(buildPrincipal(who))
    .can(CREATE_TICKET, buildProjectRecord(who, state));
}

function allowedActions(who: PrincipalFixture, options: { own?: boolean; state?: State }) {
  return ticketActionSchema.options.filter((action) => can(who, action, options));
}

describe('ticket abilities', () => {
  // The simplified form is the end users', the full form the team's; the API refuses the fields
  // of the full form to end users (§7.5).
  it.each([
    ['Create a ticket (simplified form)', 'end_user_personal', true],
    ['Create a ticket (simplified form)', 'end_user_organization', true],
    ['Create a ticket (simplified form)', 'end_user_archived_organization', false],
    ['Create a ticket (simplified form)', 'end_user', false],
    ['Create a ticket (full form)', 'developer', true],
    ['Create a ticket (full form)', 'project_manager', true],
    ['Create a ticket (full form)', 'admin', true],
    ['Create a ticket (full form)', 'team_member', false],
  ] as const)('%s – %s: %s', (_row, who, isAllowed) => {
    expect(canCreate(who)).toBe(isAllowed);
  });

  it.each([
    ['View own tickets', 'read', 'end_user_personal', true, true],
    ['View own tickets', 'read', 'end_user_personal', false, false],
    // A requester keeps reading their tickets after losing access to the project (§7.3).
    ['View own tickets', 'read', 'end_user', true, true],
    ['View all tickets of the project', 'read', 'developer', false, true],
    ['View all tickets of the project', 'read', 'admin', false, true],
    ['View all tickets of the project', 'read', 'team_member', false, false],
    ['Edit own ticket title and description', 'update', 'end_user_personal', true, true],
    ['Edit own ticket title and description', 'update', 'end_user_organization', true, true],
    ['Edit own ticket title and description', 'update', 'end_user_personal', false, false],
    // Without current access to the project a requester only reads (§7.3).
    ['Edit own ticket title and description', 'update', 'end_user', true, false],
    [
      'Edit own ticket title and description',
      'update',
      'end_user_archived_organization',
      true,
      false,
    ],
    ['Edit any ticket title and description', 'update', 'developer', false, true],
    ['Edit any ticket title and description', 'update', 'team_member', false, false],
    ['Edit ticket fields (type, priority)', 'update_fields', 'developer', false, true],
    ['Edit ticket fields (type, priority)', 'update_fields', 'end_user_personal', true, false],
    ['Assign tickets', 'assign', 'project_manager', false, true],
    ['Assign tickets', 'assign', 'admin', false, true],
    ['Assign tickets', 'assign', 'developer', false, false],
    ['Assign tickets (to self only)', 'assign_self', 'developer', false, true],
    ['Assign tickets (to self only)', 'assign_self', 'end_user_personal', true, false],
  ] as const)('%s (%s) – %s, own: %s: %s', (_row, action, who, own, isAllowed) => {
    expect(can(who, action, { own })).toBe(isAllowed);
  });

  // The actions of the ticket response for every principal (§18.3).
  it.each([
    ['admin', false, 'active', ticketActionSchema.options],
    ['admin', false, 'archived', ['read']],
    ['project_manager', false, 'active', ticketActionSchema.options],
    ['project_manager', false, 'archived', ['read']],
    ['developer', false, 'active', ['read', 'update', 'update_fields', 'assign_self']],
    ['developer', true, 'active', ['read', 'update', 'update_fields', 'assign_self']],
    ['developer', false, 'archived', ['read']],
    ['team_member', false, 'active', []],
    ['end_user_personal', true, 'active', ['read', 'update']],
    ['end_user_personal', true, 'archived', ['read']],
    ['end_user_personal', false, 'active', []],
    ['end_user_organization', true, 'active', ['read', 'update']],
    ['end_user_archived_organization', true, 'active', ['read']],
    ['end_user', true, 'active', ['read']],
  ] as const)(
    '%s on a ticket (own: %s) of an %s project may perform %o',
    (who, own, state, actions) => {
      expect(allowedActions(who, { own, state })).toEqual(actions);
    },
  );

  it.each(['active', 'archived'] as const)(
    'holds the hierarchy on an %s project: Developer ⊆ Project manager ⊆ Administrator (§7.2)',
    (state) => {
      for (const action of ticketActionSchema.options) {
        if (can('developer', action, { state })) {
          expect(can('project_manager', action, { state }), action).toBe(true);
        }
        if (can('project_manager', action, { state })) {
          expect(can('admin', action, { state }), action).toBe(true);
        }
      }
      if (canCreate('developer', state)) {
        expect(canCreate('project_manager', state)).toBe(true);
      }
    },
  );

  it('grants a team account nothing of the end-user rows, even on a ticket it requested (§7.1)', () => {
    expect(allowedActions('team_member', { own: true })).toEqual([]);
  });

  it.each(PRINCIPAL_FIXTURES)(
    'refuses %s every change of a ticket of an archived project with project.archived',
    (who) => {
      const ability = abilities.forPrincipal(buildPrincipal(who));
      const record = buildTicketRecord(who, { own: true, state: 'archived' });

      for (const action of ticketActionSchema.options.filter((a) => a !== 'read')) {
        expect(ability.can(action, record), action).toBe(false);
        const reason = ability.relevantRuleFor(action, record)?.reason;
        if (ability.can('read', record)) {
          expect(reasonCode(reason), action).toBe('project.archived');
        }
      }
      expect(canCreate(who, 'archived')).toBe(false);
    },
  );

  it('denies an action without a rule with 403', () => {
    const ability = abilities.forPrincipal(buildPrincipal('developer'));

    const rule = ability.relevantRuleFor('assign', buildTicketRecord('developer'));

    expect(reasonCode(rule?.reason)).toBe('request.forbidden');
  });
});
