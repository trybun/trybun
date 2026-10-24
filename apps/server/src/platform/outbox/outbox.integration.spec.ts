// One file for every test with a running outbox publisher: publishers of parallel test files
// would take each other's events from the shared database.
import type { Server } from 'node:http';
import { getQueueToken, Processor, WorkerHost } from '@nestjs/bullmq';
import { Controller, HttpCode, type INestApplication, Injectable, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Job, Queue } from 'bullmq';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { createOutboxEvent } from '../../../test/factories/outbox-event.factory.js';
import { captureLogs } from '../../../test/logging/captured-logs.js';
import { Clock } from '../clock/clock.js';
import { ClockModule } from '../clock/clock.module.js';
import { ConfigModule } from '../config/config.module.js';
import { loadConfig } from '../config/load-config.js';
import { DatabaseModule } from '../database/database.module.js';
import { ErrorsModule } from '../errors/errors.module.js';
import { API_PREFIX } from '../http/api-prefix.js';
import { HttpModule } from '../http/http.module.js';
import { LogContext } from '../logging/log-context.js';
import { LOG_DESTINATION, LoggingModule } from '../logging/logging.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { QueuesModule } from '../queues/queues.module.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';
import { OutboxWorkerModule } from './outbox-worker.module.js';
import { OUTBOX_PURGE_JOB, OUTBOX_QUEUE, type OutboxEventJobData } from './outbox.jobs.js';
import { OutboxModule } from './outbox.module.js';
import { OutboxProcessor } from './outbox.processor.js';
import { OutboxService } from './outbox.service.js';

const NOW = new Date('2026-11-03T09:15:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1_000;
const CONSUMER_QUEUE = 'outbox-test-consumer';
const OTHER_QUEUE = 'outbox-test-other';
const REQUESTED_QUEUE = 'outbox-test-requested';
// A few polls of the publisher.
const POLL = { timeout: 5_000 };

class RollbackError extends Error {}

/** A use case of an API call that writes an outbox event. */
@Injectable()
class RequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async request(): Promise<void> {
    await this.prisma.$transaction((tx) =>
      this.outbox.add(tx, { type: 'test.requested', payload: { subjectId: 'requested-1' } }),
    );
  }
}

@Controller('requests')
class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @HttpCode(204)
  create(): Promise<void> {
    return this.requests.request();
  }
}

/** A Worker job of the event, logging in the context of its job. */
@Processor(REQUESTED_QUEUE)
class RequestedProcessor extends WorkerHost {
  constructor(
    private readonly logContext: LogContext,
    @InjectPinoLogger(RequestedProcessor.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  process(job: Job<OutboxEventJobData>): Promise<void> {
    return this.logContext.runJob(job, () => {
      this.logger.info({ subjectId: job.data.payload.subjectId }, 'Test request handled');
      return Promise.resolve();
    });
  }
}

describe('outbox', () => {
  let app: INestApplication<Server>;
  const logs = captureLogs();
  let prisma: PrismaService;
  let outbox: OutboxService;
  let consumerQueue: Queue;

  /** Jobs of the consumer queue that carry the given subject. */
  async function jobsOf(subjectId: string): Promise<{ id: string | undefined; name: string }[]> {
    const jobs = await consumerQueue.getJobs(['waiting', 'delayed', 'active', 'completed']);
    return jobs
      .filter((job) => (job.data as OutboxEventJobData).payload.subjectId === subjectId)
      .map((job) => ({ id: job.id, name: job.name }));
  }

  async function publishedAt(id: string): Promise<Date | null | undefined> {
    const event = await prisma.outboxEvent.findUnique({ where: { id } });
    return event?.publishedAt;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(
          loadConfig({
            ...TEST_ENV,
            DATABASE_URL: inject('databaseUrl'),
            TRYBUN_VALKEY_URL: inject('valkeyUrl'),
            TRYBUN_LOG_LEVEL: 'info',
          }),
        ),
        ClockModule,
        DatabaseModule,
        LoggingModule.forRoot(),
        ErrorsModule,
        HttpModule,
        QueuesModule,
        OutboxModule,
        OutboxWorkerModule.forRoot([
          { queue: CONSUMER_QUEUE, eventTypes: ['test.happened'] },
          { queue: OTHER_QUEUE, eventTypes: ['test.other_happened'] },
          { queue: REQUESTED_QUEUE, eventTypes: ['test.requested'] },
        ]),
      ],
      controllers: [RequestsController],
      providers: [RequestsService, RequestedProcessor],
    })
      .overrideProvider(Clock)
      .useValue({ now: () => NOW })
      .overrideProvider(LOG_DESTINATION)
      .useValue(logs)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix(API_PREFIX);
    await app.init();
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

    await app.get(OutboxProcessor).process({ id: 'outbox-purge-test', data: {} } as Job);

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

  it('passes the request ID of the API call to the logs of its Worker jobs', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/requests')
      .set('X-Request-Id', 'outbox-request-1');
    expect(res.status).toBe(204);

    await expect
      .poll(() => logs.lines.find((line) => line.msg === 'Test request handled'), POLL)
      .toMatchObject({
        level: 'info',
        requestId: 'outbox-request-1',
        jobId: expect.stringMatching(/^[\da-f-]{36}$/) as unknown,
        subjectId: 'requested-1',
      });
  });
});
