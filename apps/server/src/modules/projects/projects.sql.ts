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
