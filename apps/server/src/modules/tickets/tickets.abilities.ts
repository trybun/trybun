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
 * The rules of tickets (§7.5): the team works on the tickets of their projects – a Developer
 * edits them and assigns only themselves, a Project manager assigns anyone eligible; the
 * Administrator does everything. An end user creates tickets in the projects they can read and
 * sees the tickets they requested (§3.2, `only_me` until S1-11), and edits them while they can
 * still read the project: after losing access, a requester keeps reading (§7.3). The team changes
 * the status; only the requester answers the resolution confirmation, and only while the ticket
 * waits for it (§4.3).
 */
export const ticketsAbilities: AbilityRules = ({ can, cannot }, principal) => {
  if (principal.userKind === 'end_user') {
    // The `read` conditions of the projects of an end user (§7.3): personal access, or access
    // through their active organization. `is`: the in-memory check of a record supports a to-one
    // relation only in this form.
    const personalAccess = {
      members: { some: { userId: principal.userId, role: 'end_user' as const } },
    };
    const organizationAccess = {
      organizations: {
        some: {
          organization: {
            is: { state: 'active' as const, members: { some: { userId: principal.userId } } },
          },
        },
      },
    };
    for (const access of [personalAccess, organizationAccess]) {
      can(CREATE_TICKET, PROJECT, access);
      can('update', TICKET, { requesterId: principal.userId, project: { is: access } });
    }
    can('read', TICKET, { requesterId: principal.userId });
    can('confirm_resolution', TICKET, { requesterId: principal.userId });
    // The reason makes the API answer `409` instead of `403`, and keeps the action out of
    // `allowedActions` while no answer is possible (§18.3).
    cannot('confirm_resolution', TICKET, {
      OR: [{ status: { not: 'waiting_for_requester' } }, { waitingReason: 'information' }],
    }).because('ticket.resolution_confirmation_not_pending');
    return;
  }
  if (principal.isAdmin) {
    can(CREATE_TICKET, PROJECT);
    can([...TEAM_ACTIONS], TICKET);
    return;
  }
  // Only team roles count: a membership that contradicts the account kind grants nothing (§7.1).
  const memberFrom = (role: 'developer' | 'project_manager') => ({
    members: { some: { userId: principal.userId, role: { in: teamRolesFrom(role) } } },
  });
  can(CREATE_TICKET, PROJECT, memberFrom('developer'));
  can(['read', 'update', 'update_fields', 'assign_self', 'change_status'], TICKET, {
    project: { is: memberFrom('developer') },
  });
  can('assign', TICKET, { project: { is: memberFrom('project_manager') } });
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
 * The fields of a ticket its rules read (§18.3): its requester, its status and waiting reason and,
 * of its project, the fields the project's rules read – its state, the principal's own membership
 * and the access of the principal's organization.
 */
export function ticketRuleSelect(principal: Principal) {
  return {
    id: true,
    requesterId: true,
    status: true,
    waitingReason: true,
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
