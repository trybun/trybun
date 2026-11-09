import type { Transaction } from '../../platform/database/prisma.service.js';

/**
 * Locks the row of a comment for an update for the rest of the transaction (§18.3, raw SQL), so
 * an edit, a redaction and a deletion of one comment never interleave – e.g. a draft linked by an
 * edit while the comment is deleted. Returns whether the comment exists.
 */
export async function lockCommentForUpdate(tx: Transaction, commentId: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "comments" WHERE "id" = ${commentId}::uuid FOR UPDATE`;
  return rows.length === 1;
}
