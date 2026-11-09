// The copy migrations of S1-12 (Q13, Q14): the stored rejection and sharing-refusal reasons
// become public comments before their columns are dropped. Each case restores the dropped column
// in a database of its own, seeds a ticket as S1-06 and S1-11 stored it, and runs the copy SQL.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createActivityEvent } from '../../../test/factories/activity-event.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { createOwnDatabase } from '../../../test/setup/own-database.js';
import { PrismaClient } from '../../generated/prisma/client.js';

const MIGRATIONS = join(import.meta.dirname, '../../../prisma/migrations');

async function copySql(name: string): Promise<string> {
  return readFile(join(MIGRATIONS, name, 'migration.sql'), 'utf8');
}

describe('the copy migrations of the reasons (S1-12)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: await createOwnDatabase() }),
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('rejection reasons (Q13)', () => {
    beforeAll(async () => {
      await prisma.$executeRawUnsafe('ALTER TABLE "tickets" ADD COLUMN "rejection_reason" TEXT');
    });

    afterEach(async () => {
      // Each case copies only its own ticket.
      await prisma.$executeRawUnsafe('UPDATE "tickets" SET "rejection_reason" = NULL');
    });

    afterAll(async () => {
      await prisma.$executeRawUnsafe('ALTER TABLE "tickets" DROP COLUMN "rejection_reason"');
    });

    async function rejectedTicket(reason: string) {
      const project = await createProject(prisma);
      const requester = await createUser(prisma, { kind: 'end_user' });
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: requester.id,
        source: 'user',
        status: 'rejected',
        type: null,
      });
      await prisma.$executeRaw`UPDATE "tickets" SET "rejection_reason" = ${reason} WHERE "id" = ${ticket.id}::uuid`;
      return { ticket, requester };
    }

    it('copies a reason with the author and the time of the latest rejection', async () => {
      const { ticket } = await rejectedTicket('Works as designed');
      const developer = await createUser(prisma, { kind: 'team' });
      const event = await createActivityEvent(prisma, {
        ticketId: ticket.id,
        actorId: developer.id,
        type: 'status_changed',
        data: { from: 'triage', to: 'rejected' },
        isPublic: true,
      });

      await prisma.$executeRawUnsafe(
        await copySql('20261110000100_copy_rejection_reasons_into_comments'),
      );

      expect(await prisma.comment.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
        {
          authorId: developer.id,
          kind: 'public',
          audience: 'only_me',
          body: 'Works as designed',
          createdAt: event.createdAt,
        },
      ]);
    });

    it('never aborts without an event: the author falls back to the requester at last', async () => {
      const { ticket, requester } = await rejectedTicket('Out of scope');

      await prisma.$executeRawUnsafe(
        await copySql('20261110000100_copy_rejection_reasons_into_comments'),
      );

      // A database of its own: no assignee, no Administrator, so the requester.
      expect(await prisma.comment.findMany({ where: { ticketId: ticket.id } })).toMatchObject([
        { authorId: requester.id, body: 'Out of scope', createdAt: ticket.updatedAt },
      ]);
    });
  });
});
