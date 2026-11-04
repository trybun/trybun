import { Prisma } from '../../generated/prisma/client.js';
import { TERMINAL_TICKET_STATUSES } from '@trybun/contracts/tickets';
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

/** A ticket unassigned by the system, with the fields its activity event records. */
export interface UnassignedTicket {
  id: string;
  title: string;
  description: string;
  type: string | null;
  priority: string;
}

/**
 * Unassigns up to `limit` open tickets of a person (§7.4, raw SQL) – in one project, or in every
 * project when `projectId` is `null` – and returns them. The condition is the assignee and the
 * status, never a version read earlier: a concurrent change waits for the row and is re-checked,
 * so no ticket is skipped. The version increases, so a person editing at the same time gets
 * `412`; `updated_at` is set here, as Prisma sets it only in the client.
 */
export function unassignOpenTickets(
  tx: Transaction,
  userId: string,
  projectId: string | null,
  limit: number,
): Promise<UnassignedTicket[]> {
  const terminal = Prisma.join(TERMINAL_TICKET_STATUSES);
  const inProject =
    projectId === null ? Prisma.empty : Prisma.sql`AND "project_id" = ${projectId}::uuid`;
  return tx.$queryRaw<UnassignedTicket[]>`
    UPDATE "tickets"
    SET "assignee_id" = NULL, "version" = "version" + 1, "updated_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "tickets"
      WHERE "assignee_id" = ${userId}::uuid
        AND "status" NOT IN (${terminal})
        ${inProject}
      ORDER BY "id"
      LIMIT ${limit}
    )
      AND "assignee_id" = ${userId}::uuid
      AND "status" NOT IN (${terminal})
    RETURNING "id", "title", "description", "type"::text AS "type", "priority"::text AS "priority"`;
}
