import type { Transaction } from '../../platform/database/prisma.service.js';

/**
 * Locks the row of a project for the rest of the transaction in share mode (§18.3, raw SQL):
 * memberships are not versioned, so a membership change takes this lock before it re-reads the
 * project. A concurrent archive – an update of the row – then waits for it to commit, or it waits
 * for the archive and reads the archived state. Returns whether the project exists.
 */
export async function lockProjectForShare(tx: Transaction, projectId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "projects" WHERE "id" = ${projectId}::uuid FOR SHARE`;
  return rows.length > 0;
}

/**
 * Locks the row of a project for the rest of the transaction for an update (§18.3, raw SQL): a
 * change of the key or a deletion takes it before it checks whether the project has tickets, so a
 * concurrent creation of the first ticket – holding the share lock – either commits first and is
 * seen, or waits for it. Returns whether the project exists.
 */
export async function lockProjectForUpdate(tx: Transaction, projectId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "projects" WHERE "id" = ${projectId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Locks the membership of an account in a project in share mode for the rest of the transaction
 * (§18.3, raw SQL): an assignment takes it before it checks that the assignee is a member, so a
 * concurrent removal – which deletes the row – waits for it. Returns whether the membership exists.
 */
export async function lockProjectMemberForShare(
  tx: Transaction,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ project_id: string }[]>`
    SELECT "project_id" FROM "project_members"
    WHERE "project_id" = ${projectId}::uuid AND "user_id" = ${userId}::uuid FOR SHARE`;
  return rows.length > 0;
}
