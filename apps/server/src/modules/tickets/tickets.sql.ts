import type { Transaction } from '../../platform/database/prisma.service.js';

/**
 * Allocates the next number of a project's tickets (§17.2, raw SQL): one upsert of the counter,
 * which holds its row lock until the transaction ends, so concurrent creations in one project are
 * serialized here and get consecutive numbers. A rolled-back creation rolls back its increment;
 * the counter is never lowered, so a number is never reused.
 */
export async function allocateTicketNumber(tx: Transaction, projectId: string): Promise<number> {
  const [row] = await tx.$queryRaw<{ last_number: number }[]>`
    INSERT INTO "ticket_number_counters" ("project_id", "last_number")
    VALUES (${projectId}::uuid, 1)
    ON CONFLICT ("project_id")
    DO UPDATE SET "last_number" = "ticket_number_counters"."last_number" + 1
    RETURNING "last_number"`;
  if (row === undefined) {
    throw new Error(`No ticket number allocated for the project ${projectId}`);
  }
  return row.last_number;
}
