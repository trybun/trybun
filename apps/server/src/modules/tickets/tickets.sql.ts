import { Prisma } from '../../generated/prisma/client.js';
import {
  publicStatusOf,
  TERMINAL_TICKET_STATUSES,
  ticketStatusSchema,
} from '@trybun/contracts/tickets';
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

/**
 * Locks the rows of tickets for an update for the rest of the transaction (§18.3, raw SQL), in ID
 * order so that two changes locking the same tickets never wait for each other in a cycle: a
 * change of a duplicate's link locks the duplicate, its original and the duplicates that point to
 * it. Returns the IDs of the tickets that exist.
 */
export async function lockTicketsForUpdate(
  tx: Transaction,
  ticketIds: readonly string[],
): Promise<string[]> {
  if (ticketIds.length === 0) {
    return [];
  }
  const ids = Prisma.join([...new Set(ticketIds)].sort().map((id) => Prisma.sql`${id}::uuid`));
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "tickets" WHERE "id" IN (${ids}) ORDER BY "id" FOR UPDATE`;
  return rows.map((row) => row.id);
}

/** The internal statuses whose public status is `awaiting_reply` (§4.2). */
const AWAITING_REPLY_STATUSES = ticketStatusSchema.options.filter(
  (status) => publicStatusOf(status) === 'awaiting_reply',
);

/**
 * The sort key of a requested ticket in "My tickets" (§5.7, Q10): whether it awaits the
 * requester's reply, its update time and its ID.
 */
export interface RequestedTicketKey {
  id: string;
  awaitingReply: boolean;
  updatedAt: Date;
}

/**
 * The tickets a person requested (`involvement=mine`, raw SQL), in the fixed order of the list:
 * those awaiting the requester's reply first, then the most recently updated, then by ID – the
 * first key is derived from the status, which Prisma cannot order by. It filters only by the
 * requester, the projects and the keyset cursor, and returns up to `limit` keys: the records are
 * loaded through the ability afterwards, so visibility is never re-implemented here (§18.3).
 */
export function listRequestedTicketKeys(
  db: Transaction,
  requesterId: string,
  options: {
    projectIds: readonly string[] | null;
    after: RequestedTicketKey | null;
    limit: number;
  },
): Promise<RequestedTicketKey[]> {
  const awaiting = Prisma.sql`("status"::text IN (${Prisma.join(AWAITING_REPLY_STATUSES)}))`;
  const inProject =
    options.projectIds === null
      ? Prisma.empty
      : Prisma.sql`AND "project_id" IN (${Prisma.join(options.projectIds.map((id) => Prisma.sql`${id}::uuid`))})`;
  const { after } = options;
  // Every key descends, so the rows after the cursor are those with a smaller row value.
  const afterCursor =
    after === null
      ? Prisma.empty
      : Prisma.sql`AND (${awaiting}, "updated_at", "id") < (${after.awaitingReply}::boolean, ${after.updatedAt}::timestamptz, ${after.id}::uuid)`;
  return db.$queryRaw<RequestedTicketKey[]>`
    SELECT "id", ${awaiting} AS "awaitingReply", "updated_at" AS "updatedAt"
    FROM "tickets"
    WHERE "requester_id" = ${requesterId}::uuid
      ${inProject}
      ${afterCursor}
    ORDER BY ${awaiting} DESC, "updated_at" DESC, "id" DESC
    LIMIT ${options.limit}`;
}
