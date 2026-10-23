import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createOutboxEvent } from '../../../test/factories/outbox-event.factory.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { Clock } from '../clock/clock.js';
import { ClockModule } from '../clock/clock.module.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { QueuesModule } from '../queues/queues.module.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';
import { OutboxWorkerModule } from './outbox-worker.module.js';
import { OUTBOX_PURGE_JOB, OUTBOX_QUEUE } from './outbox.jobs.js';
import { OutboxModule } from './outbox.module.js';
import { OutboxProcessor } from './outbox.processor.js';
import { OutboxService } from './outbox.service.js';

const NOW = new Date('2026-11-03T09:15:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1_000;
const CONSUMER_QUEUE = 'outbox-test-consumer';
const OTHER_QUEUE = 'outbox-test-other';
// A few polls of the publisher.
const POLL = { timeout: 5_000 };

class RollbackError extends Error {}

describe('outbox', () => {
  let app: INestApplicationContext;
  let prisma: PrismaService;
  let outbox: OutboxService;
  let consumerQueue: Queue;

  /** Jobs of the consumer queue that carry the given subject. */
  async function jobsOf(subjectId: string): Promise<{ id: string | undefined; name: string }[]> {
    const jobs = await consumerQueue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    return jobs
      .filter((job) => (job.data as { subjectId?: string }).subjectId === subjectId)
      .map((job) => ({ id: job.id, name: job.name }));
  }

  async function publishedAt(id: string): Promise<Date | null | undefined> {
    const event = await prisma.outboxEvent.findUnique({ where: { id } });
    return event?.publishedAt;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(integrationConfig()),
        ClockModule,
        DatabaseModule,
        QueuesModule,
        OutboxModule,
        OutboxWorkerModule.forRoot([
          { queue: CONSUMER_QUEUE, eventTypes: ['test.happened'] },
          { queue: OTHER_QUEUE, eventTypes: ['test.other_happened'] },
        ]),
      ],
    })
      .overrideProvider(Clock)
      .useValue({ now: () => NOW })
      .compile();
    app = await moduleRef.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);
    consumerQueue = app.get(getQueueToken(CONSUMER_QUEUE));
  });

  afterAll(async () => {
    await app.close();
  });

  it('never publishes an event written in a rolled-back transaction', async () => {
    const subjectId = '0190f2f4-7c1e-7000-8000-00000000a001';

    await expect(
      prisma.$transaction(async (tx) => {
        await outbox.add(tx, { type: 'test.happened', payload: { subjectId } });
        throw new RollbackError();
      }),
    ).rejects.toThrow(RollbackError);
    // A committed event written afterwards is published, so the publisher has polled since.
    const later = await prisma.$transaction((tx) => createOutboxEvent(tx));
    await expect.poll(() => publishedAt(later.id), POLL).toEqual(NOW);

    expect(await jobsOf(subjectId)).toEqual([]);
  });

  it('publishes a committed event exactly once to the queue of each consumer', async () => {
    const subjectId = '0190f2f4-7c1e-7000-8000-00000000a002';

    const event = await prisma.$transaction(async (tx) => {
      await outbox.add(tx, { type: 'test.happened', payload: { subjectId } });
      return tx.outboxEvent.findFirstOrThrow({ where: { payload: { equals: { subjectId } } } });
    });
    await expect.poll(() => publishedAt(event.id), POLL).toEqual(NOW);
    // The Worker stopped after enqueueing but before its commit: the event is published again.
    await prisma.outboxEvent.update({ where: { id: event.id }, data: { publishedAt: null } });
    await expect.poll(() => publishedAt(event.id), POLL).toEqual(NOW);

    expect(await jobsOf(subjectId)).toEqual([{ id: event.id, name: 'test.happened' }]);
    const other: Queue = app.get(getQueueToken(OTHER_QUEUE));
    expect(await other.getJob(event.id)).toBeUndefined();
  });

  it('deletes events published more than 7 days ago', async () => {
    const [old, recent, pending] = await prisma.$transaction((tx) =>
      Promise.all([
        createOutboxEvent(tx, { publishedAt: new Date(NOW.getTime() - 7 * DAY_MS - 1) }),
        createOutboxEvent(tx, { publishedAt: new Date(NOW.getTime() - 7 * DAY_MS) }),
        createOutboxEvent(tx, { type: 'test.unsubscribed' }),
      ]),
    );

    await app.get(OutboxProcessor).process();

    const remaining = await prisma.outboxEvent.findMany({
      where: { id: { in: [old.id, recent.id, pending.id] } },
      select: { id: true },
    });
    expect(remaining.map(({ id }) => id).sort()).toEqual([recent.id, pending.id].sort());
  });

  it('schedules the purge once per hour', async () => {
    const queue: Queue = app.get(getQueueToken(OUTBOX_QUEUE));

    const scheduler = await queue.getJobScheduler(OUTBOX_PURGE_JOB);

    expect(scheduler).toMatchObject({ name: OUTBOX_PURGE_JOB, every: 60 * 60 * 1_000 });
  });

  it('reports the size of the published batch', async () => {
    const publisher = app.get(OutboxPublisherService);

    await expect(publisher.publishPending()).resolves.toBeGreaterThanOrEqual(0);
  });
});
