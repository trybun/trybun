import type { Transaction } from '../../platform/database/prisma.service.js';

/**
 * Locks the row of an attachment for the rest of the transaction (§18.3, raw SQL): attachments are
 * not versioned, so a deletion takes this lock before it reads whether the attachment is linked,
 * and a concurrent link – an update of the row – waits for it or is seen. Returns whether it
 * exists.
 */
export async function lockAttachmentForUpdate(
  tx: Transaction,
  attachmentId: string,
): Promise<boolean> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "attachments" WHERE "id" = ${attachmentId}::uuid FOR UPDATE`;
  return rows.length > 0;
}
