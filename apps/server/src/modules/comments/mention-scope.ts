import { accessibleBy } from '@casl/prisma/runtime';
import type { CommentKind } from '@trybun/contracts/comments';
import type { TicketVisibility } from '@trybun/contracts/tickets';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import type { AppAbility } from '../../platform/authorization/ability-factory.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import { COMMENT } from './comments.abilities.js';

/** The fields of a ticket the mention scope reads (§7.3, S1-12 Q4). */
export interface MentionedTicket {
  id: string;
  projectId: string;
  requesterId: string;
  organizationId: string | null;
  assigneeId: string | null;
  visibility: TicketVisibility;
}

/**
 * The project's team members (S1-05 Q9): active team accounts with the Developer role or higher
 * in the project – those who read its tickets (§7.5), as the assignee picker lists them.
 */
function teamOf(projectId: string): Prisma.UserWhereInput {
  return {
    kind: 'team',
    projectMemberships: { some: { projectId, role: { in: teamRolesFrom('developer') } } },
  };
}

/**
 * An end user's access to the project (§7.3): a personal membership, or the project of their
 * active organization. R3 and R4 of S1-11 need it.
 */
function projectAccess(projectId: string): Prisma.UserWhereInput {
  return {
    OR: [
      { projectMemberships: { some: { projectId, role: 'end_user' } } },
      {
        organizationMember: {
          is: { organization: { is: { state: 'active', projects: { some: { projectId } } } } },
        },
      },
    ],
  };
}

/**
 * The members of an organization who read a ticket of it (§7.3, S1-11): `my_organization` needs
 * the active organization (R3), `all_customers` only the access to the project (R4).
 */
function customersOf(
  organizationId: string,
  ticket: MentionedTicket,
): Prisma.UserWhereInput | null {
  if (ticket.visibility === 'only_me') {
    return null;
  }
  if (ticket.visibility === 'my_organization' && organizationId !== ticket.organizationId) {
    return null;
  }
  return {
    kind: 'end_user',
    organizationMember: {
      is: {
        organizationId,
        ...(ticket.visibility === 'my_organization'
          ? { organization: { is: { state: 'active' } } }
          : {}),
      },
    },
    AND: [projectAccess(ticket.projectId)],
  };
}

/**
 * The requester while they read their ticket (S1-11 R1, R2): always an own `only_me` or
 * `all_customers` ticket, a `my_organization` one while they belong to its organization.
 */
function requesterOf(ticket: MentionedTicket): Prisma.UserWhereInput {
  return {
    id: ticket.requesterId,
    kind: 'end_user',
    ...(ticket.visibility === 'my_organization'
      ? { organizationMember: { is: { organizationId: ticket.organizationId ?? undefined } } }
      : {}),
  };
}

/**
 * Who a comment may mention (§7.3, S1-12 Q4, Q20): only people who read the ticket **and** would
 * read the comment, as the conditions of a query, so the same rule serves the suggestions and the
 * check on saving.
 * - An internal note: the project's team members.
 * - A public comment of the team: the team members, the requester, and the customers of the
 *   ticket's organization when its visibility includes them.
 * - A public comment of an end user: the team members who take part in the ticket – its assignee
 *   and those who wrote a public comment the author reads (Q20) – and the customers of the
 *   author's organization when the visibility includes them.
 * Deactivated, invited and anonymized accounts are never in the scope.
 */
export function mentionScope(
  principal: UserPrincipal,
  ability: AppAbility,
  ticket: MentionedTicket,
  kind: CommentKind,
  authorOrganizationId: string | null,
): Prisma.UserWhereInput {
  const team = teamOf(ticket.projectId);
  const people: Prisma.UserWhereInput[] = [];
  if (kind === 'internal') {
    people.push(team);
  } else if (principal.userKind !== 'end_user') {
    people.push(team, requesterOf(ticket));
    const customers =
      ticket.organizationId === null ? null : customersOf(ticket.organizationId, ticket);
    if (customers !== null) {
      people.push(customers);
    }
  } else {
    people.push({
      AND: [
        team,
        {
          OR: [
            ...(ticket.assigneeId === null ? [] : [{ id: ticket.assigneeId }]),
            {
              comments: {
                some: {
                  AND: [
                    accessibleBy(ability, 'read').ofType(COMMENT),
                    { ticketId: ticket.id, kind: 'public' },
                  ],
                },
              },
            },
          ],
        },
      ],
    });
    const customers =
      authorOrganizationId === null ? null : customersOf(authorOrganizationId, ticket);
    if (customers !== null) {
      people.push(customers);
    }
  }
  return { state: 'active', OR: people };
}
