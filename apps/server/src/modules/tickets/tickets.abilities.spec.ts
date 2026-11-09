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
  ASSIGN_TICKETS,
  ASSIGN_TICKETS_SELF,
  archivedProjectsOfTicketsRestriction,
  CREATE_TICKET,
  CREATE_TICKET_ALL_CUSTOMERS,
  CREATE_TICKET_MY_ORGANIZATION,
  ticketsAbilities,
} from './tickets.abilities.js';
import { FixedClock } from '../../../test/fixed-clock.js';

const abilities = new AbilityFactory(
  [projectsAbilities, ticketsAbilities],
  [archivedProjectsRestriction, archivedProjectsOfTicketsRestriction],
  new FixedClock(),
);

type State = 'active' | 'archived';
type RecordOptions = Parameters<typeof buildTicketRecord>[1];

function can(who: PrincipalFixture, action: TicketAction, options: RecordOptions = {}) {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, buildTicketRecord(who, options));
}

function canOnProject(
  who: PrincipalFixture,
  action:
    | typeof CREATE_TICKET
    | typeof ASSIGN_TICKETS
    | typeof ASSIGN_TICKETS_SELF
    | typeof CREATE_TICKET_MY_ORGANIZATION
    | typeof CREATE_TICKET_ALL_CUSTOMERS,
  state: State = 'active',
) {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, buildProjectRecord(who, state));
}

function canCreate(who: PrincipalFixture, state: State = 'active') {
  return canOnProject(who, CREATE_TICKET, state);
}

function allowedActions(who: PrincipalFixture, options: RecordOptions) {
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

  // The project's counterparts of `assign` and `assign_self` for the full form (S1-10 Q15).
  it.each([
    ['Assign tickets', ASSIGN_TICKETS, 'project_manager', true],
    ['Assign tickets', ASSIGN_TICKETS, 'admin', true],
    ['Assign tickets', ASSIGN_TICKETS, 'developer', false],
    ['Assign tickets', ASSIGN_TICKETS, 'end_user_personal', false],
    ['Assign tickets (to self only)', ASSIGN_TICKETS_SELF, 'developer', true],
    ['Assign tickets (to self only)', ASSIGN_TICKETS_SELF, 'project_manager', true],
    ['Assign tickets (to self only)', ASSIGN_TICKETS_SELF, 'admin', true],
    ['Assign tickets (to self only)', ASSIGN_TICKETS_SELF, 'team_member', false],
    ['Assign tickets (to self only)', ASSIGN_TICKETS_SELF, 'end_user_personal', false],
  ] as const)('%s on the project (%s) – %s: %s', (_row, action, who, isAllowed) => {
    expect(canOnProject(who, action)).toBe(isAllowed);
  });

  // The visibility of a new ticket (S1-11 Q7, Q19).
  it.each([
    [CREATE_TICKET_MY_ORGANIZATION, 'end_user_organization', true],
    [CREATE_TICKET_MY_ORGANIZATION, 'end_user_personal', false],
    [CREATE_TICKET_MY_ORGANIZATION, 'end_user_archived_organization', false],
    [CREATE_TICKET_MY_ORGANIZATION, 'developer', false],
    [CREATE_TICKET_MY_ORGANIZATION, 'admin', false],
    [CREATE_TICKET_ALL_CUSTOMERS, 'end_user_organization', true],
    [CREATE_TICKET_ALL_CUSTOMERS, 'end_user_personal', true],
    [CREATE_TICKET_ALL_CUSTOMERS, 'end_user', false],
    [CREATE_TICKET_ALL_CUSTOMERS, 'developer', false],
    [CREATE_TICKET_ALL_CUSTOMERS, 'admin', false],
  ] as const)('%s on the project – %s: %s', (action, who, isAllowed) => {
    expect(canOnProject(who, action)).toBe(isAllowed);
    expect(canOnProject(who, action, 'archived')).toBe(false);
  });

  it.each([ASSIGN_TICKETS, ASSIGN_TICKETS_SELF] as const)(
    'refuses %s in an archived project, also to the Administrator',
    (action) => {
      expect(canOnProject('admin', action, 'archived')).toBe(false);
      expect(canOnProject('project_manager', action, 'archived')).toBe(false);
    },
  );

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
    ['Change status', 'change_status', 'developer', false, true],
    ['Change status', 'change_status', 'project_manager', false, true],
    ['Change status', 'change_status', 'admin', false, true],
    ['Change status', 'change_status', 'team_member', false, false],
    ['Change status', 'change_status', 'end_user_personal', true, false],
    ['Add attachments to visible tickets', 'add_attachment', 'end_user_personal', true, true],
    ['Add attachments to visible tickets', 'add_attachment', 'end_user_organization', true, true],
    ['Add attachments to visible tickets', 'add_attachment', 'end_user_personal', false, false],
    // Without current access to the project a requester only reads (Q14 of S1-08).
    ['Add attachments to visible tickets', 'add_attachment', 'end_user', true, false],
    ['Add attachments to visible tickets', 'add_attachment', 'developer', false, true],
    ['Add attachments to visible tickets', 'add_attachment', 'project_manager', false, true],
    ['Add attachments to visible tickets', 'add_attachment', 'admin', false, true],
    ['Add attachments to visible tickets', 'add_attachment', 'team_member', false, false],
  ] as const)('%s (%s) – %s, own: %s: %s', (_row, action, who, own, isAllowed) => {
    expect(can(who, action, { own })).toBe(isAllowed);
  });

  // The read rules R1–R4 of S1-11 (§5.1, §7.3): own tickets, the tickets of the principal's
  // organization and shared tickets.
  it.each([
    ['own only_me ticket', 'end_user_personal', { own: true }, true],
    ['own only_me ticket without project access', 'end_user', { own: true }, true],
    // Q1: the author keeps their own shared ticket without project access.
    [
      'own shared ticket without project access',
      'end_user',
      { own: true, visibility: 'all_customers' },
      true,
    ],
    [
      'own my_organization ticket of their organization',
      'end_user_organization',
      { own: true, visibility: 'my_organization', organization: 'mine' },
      true,
    ],
    // Q3: members of an archived organization keep their own tickets.
    [
      'own my_organization ticket of their archived organization',
      'end_user_archived_organization',
      {
        own: true,
        visibility: 'my_organization',
        organization: 'mine',
        organizationState: 'archived',
      },
      true,
    ],
    // §7.3: after a change of organization, own my_organization tickets of the old one disappear.
    [
      'own my_organization ticket of an organization they left',
      'end_user_personal',
      { visibility: 'my_organization', own: true, organization: 'other' },
      false,
    ],
    [
      "a colleague's my_organization ticket",
      'end_user_organization',
      { visibility: 'my_organization', organization: 'mine' },
      true,
    ],
    [
      "a colleague's my_organization ticket in a project of personal access",
      'end_user_personal',
      { visibility: 'my_organization', organization: 'mine' },
      true,
    ],
    // Q2: never a colleague's ticket of a project the principal cannot open.
    [
      "a colleague's my_organization ticket without project access",
      'end_user',
      { visibility: 'my_organization', organization: 'mine' },
      false,
    ],
    // Q3: colleagues' tickets are hidden while the organization is archived.
    [
      "a colleague's my_organization ticket of an archived organization",
      'end_user_personal',
      { visibility: 'my_organization', organization: 'mine', organizationState: 'archived' },
      false,
    ],
    [
      'a my_organization ticket of another organization',
      'end_user_organization',
      { visibility: 'my_organization', organization: 'other' },
      false,
    ],
    ["another person's only_me ticket", 'end_user_organization', { organization: 'mine' }, false],
    ['a shared ticket', 'end_user_organization', { visibility: 'all_customers' }, true],
    ['a shared ticket', 'end_user_personal', { visibility: 'all_customers' }, true],
    ['a shared ticket without project access', 'end_user', { visibility: 'all_customers' }, false],
    [
      'a shared ticket through an archived organization',
      'end_user_archived_organization',
      { visibility: 'all_customers' },
      false,
    ],
  ] as const)('reads %s – %s: %s', (_case, who, options, isAllowed) => {
    expect(can(who, 'read', options)).toBe(isAllowed);
  });

  // Reading a colleague's or a shared ticket gives no change of it (§7.5, "Edit own ticket").
  it.each([
    ['end_user_organization', { visibility: 'my_organization', organization: 'mine' }],
    ['end_user_personal', { visibility: 'all_customers' }],
  ] as const)('lets %s read but not change a ticket of someone else (%o)', (who, options) => {
    expect(can(who, 'read', options)).toBe(true);
    expect(can(who, 'update', options)).toBe(false);
    expect(can(who, 'add_attachment', options)).toBe(false);
  });

  it('lets a requester change their own my_organization ticket while they can read the project', () => {
    const options = { own: true, visibility: 'my_organization', organization: 'mine' } as const;

    expect(can('end_user_organization', 'update', options)).toBe(true);
    expect(can('end_user_organization', 'add_attachment', options)).toBe(true);
    expect(can('end_user', 'update', options)).toBe(false);
  });

  const WAITING_FOR_CONFIRMATION = {
    status: 'waiting_for_requester',
    waitingReason: 'confirmation',
  } as const;

  it.each([
    ['end_user_personal', true, WAITING_FOR_CONFIRMATION, true],
    // An end user who lost access to the project still answers for their own ticket.
    ['end_user', true, WAITING_FOR_CONFIRMATION, true],
    ['end_user_personal', false, WAITING_FOR_CONFIRMATION, false],
    [
      'end_user_personal',
      true,
      { status: 'waiting_for_requester', waitingReason: 'information' },
      false,
    ],
    ['end_user_personal', true, { status: 'done' }, false],
    // Not inherited by team roles (S1-04 Q3).
    ['admin', true, WAITING_FOR_CONFIRMATION, false],
    ['project_manager', true, WAITING_FOR_CONFIRMATION, false],
    ['developer', true, WAITING_FOR_CONFIRMATION, false],
  ] as const)(
    'Confirm or decline resolution of own ticket – %s, own: %s, %o: %s',
    (who, own, status, isAllowed) => {
      expect(can(who, 'confirm_resolution', { own, ...status })).toBe(isAllowed);
    },
  );

  it('answers a requester whose ticket waits for nothing with resolution_confirmation_not_pending', () => {
    const ability = abilities.forPrincipal(buildPrincipal('end_user_personal'));

    const rule = ability.relevantRuleFor(
      'confirm_resolution',
      buildTicketRecord('end_user_personal', { own: true, status: 'done' }),
    );

    expect(reasonCode(rule?.reason)).toBe('ticket.resolution_confirmation_not_pending');
  });

  const VISIBILITY_ACTIONS: readonly TicketAction[] = [
    'set_visibility_only_me',
    'set_visibility_my_organization',
    'set_visibility_all_customers',
    'approve_sharing',
    'reject_sharing',
  ];
  // On an `only_me` ticket without a request, the team has no visibility action (S1-11).
  const TEAM_ACTIONS = ticketActionSchema.options.filter(
    (a) => a !== 'confirm_resolution' && !VISIBILITY_ACTIONS.includes(a),
  );

  // The actions of the ticket response for every principal (§18.3).
  it.each([
    ['admin', false, 'active', TEAM_ACTIONS],
    ['admin', false, 'archived', ['read']],
    ['project_manager', false, 'active', TEAM_ACTIONS],
    ['project_manager', false, 'archived', ['read']],
    [
      'developer',
      false,
      'active',
      ['read', 'update', 'update_fields', 'assign_self', 'change_status', 'add_attachment'],
    ],
    [
      'developer',
      true,
      'active',
      ['read', 'update', 'update_fields', 'assign_self', 'change_status', 'add_attachment'],
    ],
    ['developer', false, 'archived', ['read']],
    ['team_member', false, 'active', []],
    [
      'end_user_personal',
      true,
      'active',
      ['read', 'update', 'add_attachment', 'set_visibility_all_customers'],
    ],
    ['end_user_personal', true, 'archived', ['read']],
    ['end_user_personal', false, 'active', []],
    [
      'end_user_organization',
      true,
      'active',
      ['read', 'update', 'add_attachment', 'set_visibility_all_customers'],
    ],
    ['end_user_archived_organization', true, 'active', ['read']],
    ['end_user', true, 'active', ['read']],
  ] as const)(
    '%s on a ticket (own: %s) of an %s project may perform %o',
    (who, own, state, actions) => {
      expect(allowedActions(who, { own, state })).toEqual(actions);
    },
  );

  // The visibility actions of S1-11 (§5.2, §5.3): the rows of the action table.
  const MINE = { own: true, organization: 'mine' } as const;
  it.each([
    // The requester, while they can read the project.
    [
      'requester narrows',
      'end_user_organization',
      'set_visibility_only_me',
      { ...MINE, visibility: 'my_organization' },
      true,
    ],
    ['requester keeps only_me', 'end_user_organization', 'set_visibility_only_me', MINE, false],
    [
      'requester withdraws to only_me',
      'end_user_organization',
      'set_visibility_only_me',
      { ...MINE, sharingRequest: 'pending' },
      true,
    ],
    [
      'requester narrows a shared ticket',
      'end_user_organization',
      'set_visibility_only_me',
      { ...MINE, visibility: 'all_customers' },
      false,
    ],
    [
      'requester without project access',
      'end_user',
      'set_visibility_only_me',
      { ...MINE, visibility: 'my_organization' },
      false,
    ],
    ['requester widens', 'end_user_organization', 'set_visibility_my_organization', MINE, true],
    [
      'requester withdraws to my_organization',
      'end_user_organization',
      'set_visibility_my_organization',
      { ...MINE, visibility: 'my_organization', sharingRequest: 'pending' },
      true,
    ],
    [
      'requester keeps my_organization',
      'end_user_organization',
      'set_visibility_my_organization',
      { ...MINE, visibility: 'my_organization' },
      false,
    ],
    // Q4: never to an organization the requester left.
    [
      'requester widens to a left organization',
      'end_user_organization',
      'set_visibility_my_organization',
      { own: true, organization: 'other' },
      false,
    ],
    [
      'requester widens without an organization',
      'end_user_organization',
      'set_visibility_my_organization',
      { own: true },
      false,
    ],
    [
      'requester widens in an archived organization',
      'end_user_archived_organization',
      'set_visibility_my_organization',
      { ...MINE, organizationState: 'archived' },
      false,
    ],
    // Q19: only where the organization has access to the project.
    [
      'requester widens under personal access only',
      'end_user_personal',
      'set_visibility_my_organization',
      MINE,
      false,
    ],
    [
      'requester widens a shared ticket',
      'end_user_organization',
      'set_visibility_my_organization',
      { ...MINE, visibility: 'all_customers' },
      false,
    ],
    [
      'requester requests sharing',
      'end_user_organization',
      'set_visibility_all_customers',
      MINE,
      true,
    ],
    [
      'requester requests sharing of my_organization',
      'end_user_organization',
      'set_visibility_all_customers',
      { ...MINE, visibility: 'my_organization' },
      true,
    ],
    [
      'requester requests again after a refusal',
      'end_user_organization',
      'set_visibility_all_customers',
      { ...MINE, sharingRequest: 'rejected' },
      true,
    ],
    [
      'requester requests twice',
      'end_user_organization',
      'set_visibility_all_customers',
      { ...MINE, sharingRequest: 'pending' },
      false,
    ],
    [
      'requester of a shared ticket',
      'end_user_organization',
      'set_visibility_all_customers',
      { ...MINE, visibility: 'all_customers' },
      false,
    ],
    [
      'colleague of a my_organization ticket',
      'end_user_organization',
      'set_visibility_all_customers',
      { organization: 'mine', visibility: 'my_organization' },
      false,
    ],
    [
      'end user decides a request',
      'end_user_organization',
      'approve_sharing',
      { ...MINE, sharingRequest: 'pending' },
      false,
    ],
    // The team.
    [
      'Developer narrows a shared ticket',
      'developer',
      'set_visibility_only_me',
      { visibility: 'all_customers' },
      true,
    ],
    ['Developer keeps only_me', 'developer', 'set_visibility_only_me', {}, false],
    [
      'Developer sets my_organization',
      'developer',
      'set_visibility_my_organization',
      { organization: 'other' },
      true,
    ],
    [
      'Developer sets my_organization without a snapshot',
      'developer',
      'set_visibility_my_organization',
      {},
      false,
    ],
    [
      'Developer shares a my_organization ticket',
      'developer',
      'set_visibility_all_customers',
      { organization: 'other', visibility: 'my_organization' },
      true,
    ],
    ['Developer shares an only_me ticket', 'developer', 'set_visibility_all_customers', {}, false],
    [
      'Developer changes a pending ticket',
      'developer',
      'set_visibility_only_me',
      { visibility: 'my_organization', organization: 'other', sharingRequest: 'pending' },
      false,
    ],
    [
      'Developer changes a team ticket',
      'developer',
      'set_visibility_all_customers',
      { source: 'developer', organization: 'other', visibility: 'my_organization' },
      false,
    ],
    ['Developer approves', 'developer', 'approve_sharing', { sharingRequest: 'pending' }, true],
    ['Developer refuses', 'developer', 'reject_sharing', { sharingRequest: 'pending' }, true],
    ['Developer approves without a request', 'developer', 'approve_sharing', {}, false],
    [
      'Project manager approves',
      'project_manager',
      'approve_sharing',
      { sharingRequest: 'pending' },
      true,
    ],
    ['Administrator approves', 'admin', 'approve_sharing', { sharingRequest: 'pending' }, true],
    ['Administrator shares an only_me ticket', 'admin', 'set_visibility_all_customers', {}, false],
    [
      'team member outside the project approves',
      'team_member',
      'approve_sharing',
      { sharingRequest: 'pending' },
      false,
    ],
  ] as const)('%s (%s, %s, %o): %s', (_case, who, action, options, isAllowed) => {
    expect(can(who, action, options)).toBe(isAllowed);
  });

  it.each([
    ['approve_sharing', {}, 'ticket.sharing_not_pending'],
    ['reject_sharing', { sharingRequest: 'rejected' }, 'ticket.sharing_not_pending'],
    ['set_visibility_all_customers', {}, 'ticket.author_consent_required'],
    [
      'set_visibility_only_me',
      { visibility: 'all_customers' as const, sharingRequest: 'pending' },
      'ticket.sharing_pending',
    ],
    // When two state rules apply, the request is decided first.
    ['set_visibility_all_customers', { sharingRequest: 'pending' }, 'ticket.sharing_pending'],
  ] as const)('answers the team %s on %o with %s', (action, options, code) => {
    const ability = abilities.forPrincipal(buildPrincipal('developer'));

    const rule = ability.relevantRuleFor(action, buildTicketRecord('developer', options));

    expect(ability.can(action, buildTicketRecord('developer', options))).toBe(false);
    expect(reasonCode(rule?.reason)).toBe(code);
  });

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
      const record = buildTicketRecord(who, {
        own: true,
        state: 'archived',
        ...WAITING_FOR_CONFIRMATION,
      });

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
