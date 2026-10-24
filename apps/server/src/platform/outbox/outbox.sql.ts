import type { Transaction } from '../database/prisma.service.js';

export interface PendingOutboxEventRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  requestId: string | null;
}

/**
 * Locks the oldest unpublished events (UUIDv7 IDs are time-ordered). `SKIP LOCKED` lets several
 * Worker replicas publish at the same time without taking the same event (§17.2).
 */
export function lockPendingOutboxEvents(
  tx: Transaction,
  limit: number,
): Promise<PendingOutboxEventRow[]> {
  return tx.$queryRaw<PendingOutboxEventRow[]>`
    SELECT id::text AS id, type, payload, request_id AS "requestId"
    FROM outbox_events
    WHERE published_at IS NULL
    ORDER BY id
    LIMIT ${limit}
    FOR UPDATE SKIP LOCKED
  `;
}
