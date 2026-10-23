import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Transaction } from '../database/prisma.service.js';

/** An event of a change (§18.3): identifiers and changed values, never content or personal data. */
export interface OutboxEventInput {
  /** `resource.event` in snake_case (§17.1), e.g. `ticket.status_changed`. */
  type: string;
  payload: Prisma.InputJsonObject;
}

/** Writes outbox events in the transaction of the change (§17.2). */
@Injectable()
export class OutboxService {
  async add(tx: Transaction, event: OutboxEventInput): Promise<void> {
    await tx.outboxEvent.create({ data: { type: event.type, payload: event.payload } });
  }
}
