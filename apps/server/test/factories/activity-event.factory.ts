import type { ActivityEvent, Prisma } from '../../src/generated/prisma/client.js';
import type { Transaction } from '../../src/platform/database/prisma.service.js';

/** An activity event of a ticket (§4.5): a title change by a person unless overridden. */
export function createActivityEvent(
  db: Transaction,
  input: Partial<Prisma.ActivityEventUncheckedCreateInput> & { ticketId: string },
): Promise<ActivityEvent> {
  return db.activityEvent.create({
    data: {
      type: 'title_changed',
      data: { from: 'Old title', to: 'New title' },
      ...input,
    },
  });
}
