import { type ProjectRole, projectRoleSchema } from '@trybun/contracts/projects';

/**
 * The team roles of a project from the lowest to the highest (§7.2): a Project manager has all
 * Developer permissions. The Administrator holds every rule through `isAdmin`, and the role
 * `end_user` belongs to end-user accounts, outside the hierarchy (§7.1).
 */
const TEAM_ROLES_ASCENDING: readonly ProjectRole[] = projectRoleSchema.options;

/**
 * The team roles that hold a rule granted to `lowest` and above (§7.2), for the membership
 * condition of a team rule: `{ members: { some: { userId, role: { in: teamRolesFrom(…) } } } }`.
 */
export function teamRolesFrom(lowest: ProjectRole): ProjectRole[] {
  return TEAM_ROLES_ASCENDING.slice(TEAM_ROLES_ASCENDING.indexOf(lowest));
}
