import { faker } from '@faker-js/faker';
import type { OutboxEvent, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

export function buildOutboxEvent(
  overrides: Partial<Prisma.OutboxEventCreateInput> = {},
): Prisma.OutboxEventCreateInput {
  return {
    type: 'test.happened',
    payload: { subjectId: faker.string.uuid() },
    ...overrides,
  };
}

export function createOutboxEvent(
  db: Transaction,
  overrides?: Partial<Prisma.OutboxEventCreateInput>,
): Promise<OutboxEvent> {
  return db.outboxEvent.create({ data: buildOutboxEvent(overrides) });
}
