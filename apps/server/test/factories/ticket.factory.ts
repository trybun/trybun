import { faker } from '@faker-js/faker';
import { isTerminalStatus, type TicketStatus } from '@trybun/contracts/tickets';
import type { Prisma, Ticket } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';
import { allocateTicketNumber } from '../../src/modules/tickets/tickets.sql.js';

export type TicketFactoryInput = Omit<
  Prisma.TicketUncheckedCreateInput,
  'number' | 'title' | 'source' | 'status'
> &
  Partial<Pick<Prisma.TicketUncheckedCreateInput, 'title' | 'source' | 'status'>>;

/**
 * The fields a status requires (§4.3), as the check constraints of the migrations demand: the
 * waiting fields while waiting, the closing time while terminal and the reason while rejected –
 * each unless the input sets it.
 */
function statusFields(status: TicketStatus, input: TicketFactoryInput) {
  return {
    ...(status === 'waiting_for_requester'
      ? {
          waitingReason: input.waitingReason ?? 'information',
          statusBeforeWaiting: input.statusBeforeWaiting ?? 'in_progress',
          waitingSince: input.waitingSince ?? new Date(),
        }
      : {}),
    ...(isTerminalStatus(status) ? { closedAt: input.closedAt ?? new Date() } : {}),
    ...(status === 'rejected'
      ? { rejectionReason: input.rejectionReason ?? faker.lorem.sentence() }
      : {}),
  };
}

/**
 * A ticket of a project with the next number of its counter, as the creation allocates it
 * (§17.2); a team ticket in `todo` unless the overrides say otherwise, with the fields its
 * status requires. A `duplicate` needs its relation as well (`createDuplicateRelation`).
 */
export async function createTicket(db: Transaction, input: TicketFactoryInput): Promise<Ticket> {
  const number = await allocateTicketNumber(db, input.projectId);
  const status = input.status ?? 'todo';
  return db.ticket.create({
    data: {
      title: faker.lorem.sentence({ min: 3, max: 8 }).slice(0, 255),
      source: 'developer',
      type: 'task',
      ...input,
      status,
      ...statusFields(status, input),
      number,
    },
  });
}

/** The `duplicate_of` relation of a duplicate to its original (§3.5). */
export function createDuplicateRelation(
  db: Transaction,
  duplicate: { id: string },
  original: { id: string },
) {
  return db.ticketRelation.create({
    data: { kind: 'duplicate_of', sourceTicketId: duplicate.id, targetTicketId: original.id },
  });
}
