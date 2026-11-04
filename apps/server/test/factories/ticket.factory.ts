import { faker } from '@faker-js/faker';
import type { Prisma, Ticket } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';
import { allocateTicketNumber } from '../../src/modules/tickets/tickets.sql.js';

export type TicketFactoryInput = Omit<
  Prisma.TicketUncheckedCreateInput,
  'number' | 'title' | 'source' | 'status'
> &
  Partial<Pick<Prisma.TicketUncheckedCreateInput, 'title' | 'source' | 'status'>>;

/**
 * A ticket of a project with the next number of its counter, as the creation allocates it
 * (§17.2); a team ticket in `todo` unless the overrides say otherwise.
 */
export async function createTicket(db: Transaction, input: TicketFactoryInput): Promise<Ticket> {
  const number = await allocateTicketNumber(db, input.projectId);
  return db.ticket.create({
    data: {
      title: faker.lorem.sentence({ min: 3, max: 8 }).slice(0, 255),
      source: 'developer',
      status: 'todo',
      type: 'task',
      ...input,
      number,
    },
  });
}
