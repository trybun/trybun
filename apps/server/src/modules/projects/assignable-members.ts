import type { Prisma } from '../../generated/prisma/client.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';

/**
 * The members of a project who can be assigned to its tickets (§3.2, S1-05 Q9): active team
 * accounts with a team role in it. One predicate for the assignee picker (`assignable=true` of the
 * members list, S1-10 Q9) and the check of an assignment (`TicketsService`), which takes its share
 * locks before it.
 */
export const ASSIGNABLE_MEMBER = {
  role: { in: teamRolesFrom('developer') },
  user: { kind: 'team', state: 'active' },
} satisfies Prisma.ProjectMemberWhereInput;
