import type { Transaction } from '../../platform/database/prisma.service.js';

/**
 * Locks the row of an organization for the rest of the transaction in share mode (§18.3, raw SQL):
 * memberships are not versioned, so a membership change takes this lock before it re-reads the
 * organization, and a concurrent archive waits for it or is seen. Returns whether it exists.
 */
export async function lockOrganizationForShare(
  tx: Transaction,
  organizationId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "organizations" WHERE "id" = ${organizationId}::uuid FOR SHARE`;
  return rows.length > 0;
}

/**
 * Locks the row of an organization for the rest of the transaction for an update (§18.3, raw
 * SQL): a deletion waits for the membership changes holding the share lock, and new ones wait for
 * it. Returns whether the organization exists.
 */
export async function lockOrganizationForUpdate(
  tx: Transaction,
  organizationId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "organizations" WHERE "id" = ${organizationId}::uuid FOR UPDATE`;
  return rows.length > 0;
}

/**
 * Whether another organization has the name, compared case-insensitively like the unique index
 * on `lower(name)` (§7.3).
 */
export async function isOrganizationNameTaken(
  tx: Transaction,
  name: string,
  exceptId: string | null,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "organizations"
    WHERE lower("name") = lower(${name}) AND "id" IS DISTINCT FROM ${exceptId}::uuid
    LIMIT 1`;
  return rows.length > 0;
}

/**
 * The account with a normalized e-mail address (§7.4): `users.email` is stored trimmed and
 * lower-cased, so an exact match on its unique index compares case-insensitively. An anonymized
 * account has no address and is never found.
 */
export async function findAccountByEmail(
  tx: Transaction,
  email: string,
): Promise<{ id: string; kind: 'team' | 'end_user' } | null> {
  const rows = await tx.$queryRaw<{ id: string; kind: 'team' | 'end_user' }[]>`
    SELECT "id", "kind"::text AS "kind" FROM "users"
    WHERE "email" = ${email}`;
  return rows[0] ?? null;
}
