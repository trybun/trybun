import { subject } from '@casl/ability';
import { type TicketAction, ticketActionSchema } from '@trybun/contracts/tickets';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../../platform/authentication/principal.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';
import { PROJECT, projectRuleSelect } from '../projects/projects.abilities.js';

/** The subject of the tickets (§18.3). */
export const TICKET = 'Ticket';

/** Creating a ticket, an action on its project (§7.5). */
export const CREATE_TICKET = 'create_ticket';

/**
 * Assigning the tickets of a project: anyone eligible, or only the principal (§7.5, S1-10 Q15) –
 * the project's counterparts of the ticket actions `assign` and `assign_self`, which tell the full
 * form its assignee control before the ticket exists. Creation still checks the assignee.
 */
export const ASSIGN_TICKETS = 'assign_tickets';
export const ASSIGN_TICKETS_SELF = 'assign_tickets_self';

/** The contract's closed list (§18.3): an action added to it is restricted by default. */
const ALL_ACTIONS = ticketActionSchema.options;

/**
 * The actions of the team (§7.5): every action except answering the resolution confirmation,
 * which belongs to the requester's end-user account and is not inherited by team roles (S1-04 Q3).
 */
const TEAM_ACTIONS = ALL_ACTIONS.filter((action) => action !== 'confirm_resolution');

/** The actions an archived project still allows on its tickets: reading them (§7.3). */
const ACTIONS_OF_ARCHIVED_PROJECTS: readonly TicketAction[] = ['read'];

/**
 * The membership condition of a team rule on a project (§18.3): the principal's membership with
 * `role` or a higher team role. Only team roles count, so a membership that contradicts the
 * account kind grants nothing (§7.1).
 */
export function memberFrom(principal: Principal, role: 'developer' | 'project_manager') {
  return {
    members: { some: { userId: principal.userId, role: { in: teamRolesFrom(role) } } },
  } satisfies Prisma.ProjectWhereInput;
}

/**
 * The `read` conditions of the projects of an end user (§7.3): personal access, or access through
 * their active organization. `is`: the in-memory check of a record supports a to-one relation only
 * in this form.
 */
function endUserProjectAccess(principal: Principal): Prisma.ProjectWhereInput[] {
  return [
    { members: { some: { userId: principal.userId, role: 'end_user' } } },
    {
      organizations: {
        some: {
          organization: {
            is: { state: 'active', members: { some: { userId: principal.userId } } },
          },
        },
      },
    },
  ];
}

/**
 * The organization of a ticket's snapshot while the principal still belongs to it (§7.3): a
 * person belongs to at most one organization, so this is "the snapshot is the principal's current
 * organization" as a relation condition limited to the principal (§18.3, S1-04 Q2). `active`
 * also requires the organization not to be archived.
 */
function ownOrganization(principal: Principal, state?: 'active') {
  return {
    organization: {
      is: {
        ...(state === undefined ? {} : { state }),
        members: { some: { userId: principal.userId } },
      },
    },
  } satisfies Prisma.TicketWhereInput;
}

/**
 * The own tickets an end user reads (§7.3, S1-11 Q1): R1 – own `only_me` and `all_customers`
 * tickets in any project, also without current access to it; R2 – own tickets of the organization
 * the person still belongs to, archived or not. Own `my_organization` tickets of an organization
 * the person left are not among them.
 */
function ownTicketConditions(principal: Principal): Prisma.TicketWhereInput[] {
  return [
    { requesterId: principal.userId, visibility: { in: ['only_me', 'all_customers'] } },
    { requesterId: principal.userId, ...ownOrganization(principal) },
  ];
}

/**
 * The conditions under which a principal reads a ticket (§7.5), one CASL rule per condition: an
 * end user their own tickets (R1, R2), the `my_organization` tickets of their active organization
 * (R3) and the shared tickets (R4) – the last two only in projects they can read, under each path
 * of access (S1-11 Q2, Q3); a team member the tickets of their projects; the Administrator every
 * ticket. The attachment rules wrap them, so attachments follow every visibility rule of tickets.
 */
export function ticketReadConditions(principal: Principal): Prisma.TicketWhereInput[] {
  if (principal.userKind !== 'end_user') {
    return [principal.isAdmin ? {} : { project: { is: memberFrom(principal, 'developer') } }];
  }
  const access = endUserProjectAccess(principal);
  return [
    ...ownTicketConditions(principal),
    ...access.map((project) => ({
      visibility: 'my_organization' as const,
      ...ownOrganization(principal, 'active'),
      project: { is: project },
    })),
    ...access.map((project) => ({
      visibility: 'all_customers' as const,
      project: { is: project },
    })),
  ];
}

/**
 * The conditions under which a principal changes a ticket they read – edits it or adds
 * attachments (§7.5), one rule per condition: an end user only their own tickets (R1, R2) and only
 * while they can still read the project (Q14) – reading a colleague's or a shared ticket gives no
 * change; the team under the read conditions.
 */
export function ticketChangeConditions(principal: Principal): Prisma.TicketWhereInput[] {
  if (principal.userKind !== 'end_user') {
    return ticketReadConditions(principal);
  }
  return ownTicketConditions(principal).flatMap((own) =>
    endUserProjectAccess(principal).map((project) => ({ ...own, project: { is: project } })),
  );
}

/**
 * The rules of tickets (§7.5): the team works on the tickets of their projects – a Developer
 * edits them, adds attachments and assigns only themselves, a Project manager assigns anyone
 * eligible; the Administrator does everything. An end user creates tickets in the projects they
 * can read and sees the tickets they requested, and edits them and adds attachments while they can
 * still read the project: after losing access, a requester keeps reading (§7.3). The team changes
 * the status; only the requester answers the resolution confirmation, and only while the ticket
 * waits for it (§4.3). The project actions `assign_tickets` and `assign_tickets_self` follow `assign`
 * and `assign_self`; an archived project allows neither (`archivedProjectsRestriction`).
 */
export const ticketsAbilities: AbilityRules = ({ can, cannot }, principal) => {
  if (principal.userKind === 'end_user') {
    for (const access of endUserProjectAccess(principal)) {
      can(CREATE_TICKET, PROJECT, access);
    }
    for (const conditions of ticketChangeConditions(principal)) {
      can(['update', 'add_attachment'], TICKET, conditions);
    }
    for (const conditions of ticketReadConditions(principal)) {
      can('read', TICKET, conditions);
    }
    can('confirm_resolution', TICKET, { requesterId: principal.userId });
    // The reason makes the API answer `409` instead of `403`, and keeps the action out of
    // `allowedActions` while no answer is possible (§18.3).
    cannot('confirm_resolution', TICKET, {
      OR: [{ status: { not: 'waiting_for_requester' } }, { waitingReason: 'information' }],
    }).because('ticket.resolution_confirmation_not_pending');
    return;
  }
  if (principal.isAdmin) {
    can([CREATE_TICKET, ASSIGN_TICKETS, ASSIGN_TICKETS_SELF], PROJECT);
    can([...TEAM_ACTIONS], TICKET);
    return;
  }
  can([CREATE_TICKET, ASSIGN_TICKETS_SELF], PROJECT, memberFrom(principal, 'developer'));
  can(ASSIGN_TICKETS, PROJECT, memberFrom(principal, 'project_manager'));
  for (const conditions of ticketReadConditions(principal)) {
    can(
      ['read', 'update', 'update_fields', 'assign_self', 'change_status', 'add_attachment'],
      TICKET,
      conditions,
    );
  }
  can('assign', TICKET, { project: { is: memberFrom(principal, 'project_manager') } });
};

/**
 * A global restriction (§18.3), added after every rule: the tickets of an archived project are
 * read-only for everyone, the Administrator included, until it is unarchived (§7.3). Its reason
 * makes the API answer `409 project.archived` instead of `403`. Creating a ticket is an action of
 * the project, refused by the restriction of archived projects.
 */
export const archivedProjectsOfTicketsRestriction: AbilityRules = ({ cannot }) => {
  cannot(
    ALL_ACTIONS.filter((action) => !ACTIONS_OF_ARCHIVED_PROJECTS.includes(action)),
    TICKET,
    { project: { is: { state: 'archived' } } },
  ).because('project.archived');
};

/**
 * The fields of a ticket its rules read (§18.3): its requester, source, status and waiting reason,
 * its visibility and sharing request, of its organization snapshot the state and the principal's
 * own membership, and, of its project, the fields the project's rules read – its state, the principal's own membership
 * and the access of the principal's organization.
 */
export function ticketRuleSelect(principal: Principal) {
  return {
    id: true,
    requesterId: true,
    status: true,
    waitingReason: true,
    source: true,
    visibility: true,
    sharingRequest: true,
    organizationId: true,
    organization: {
      select: {
        state: true,
        members: { where: { userId: principal.userId }, select: { userId: true } },
      },
    },
    project: { select: projectRuleSelect(principal) },
  } satisfies Prisma.TicketSelect;
}

/** How the record access loads a ticket (§18.3). */
export const ticketRecords: RecordDescriptor<'Ticket'> = {
  subject: TICKET,
  async find(db, where, principal) {
    const row = await db.ticket.findFirst({ where, select: ticketRuleSelect(principal) });
    return row === null ? null : subject(TICKET, row);
  },
};
