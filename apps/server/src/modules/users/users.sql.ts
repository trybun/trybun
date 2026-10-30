import type { Transaction } from '../../platform/database/prisma.service.js';

/**
 * Locks the active Administrators for the rest of the transaction (§18.3, raw SQL) and returns
 * their IDs: a change that may remove the last one (deactivation, revoking the role, §7.4) takes
 * this lock before it counts them, so two concurrent changes never remove both of the last two.
 */
export async function lockActiveAdministrators(tx: Transaction): Promise<string[]> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "users" WHERE "is_admin" AND "state" = 'active' ORDER BY "id" FOR UPDATE`;
  return rows.map(({ id }) => id);
}

/**
 * Locks the row of an account for the rest of the transaction (§18.3, raw SQL): accounts are not
 * versioned, so a change of the state or of the Administrator role takes this lock before it
 * re-reads the account. Returns whether it exists.
 */
export async function lockAccount(tx: Transaction, userId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "users" WHERE "id" = ${userId}::uuid FOR UPDATE`;
  return rows.length > 0;
}
