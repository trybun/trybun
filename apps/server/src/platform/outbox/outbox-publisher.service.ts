import { setTimeout as sleep } from 'node:timers/promises';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { Clock } from '../clock/clock.js';
import { PrismaService } from '../database/prisma.service.js';
import { lockPendingOutboxEvents } from './outbox.sql.js';

/** The queues of the consumers of each event type. */
export const OUTBOX_TARGETS = 'OUTBOX_TARGETS';
export type OutboxTargets = ReadonlyMap<string, readonly Queue[]>;

export const OUTBOX_POLL_INTERVAL_MS = 1_000;
export const OUTBOX_BATCH_SIZE = 100;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1_000;

/**
 * Publishes outbox events to the queues of their consumers (§17.2). It polls about once per
 * second; a full batch is followed by the next one at once.
 */
@Injectable()
export class OutboxPublisherService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private readonly stopping = new AbortController();
  private polling: Promise<void> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(OUTBOX_TARGETS) private readonly targets: OutboxTargets,
  ) {}

  onApplicationBootstrap(): void {
    this.polling = this.poll();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping.abort();
    await this.polling;
  }

  /**
   * Publishes one batch and returns its size. The job ID is the event ID, so publishing an event
   * again – after a crash between enqueueing and the commit – creates no second job (§17.2).
   */
  async publishPending(): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const events = await lockPendingOutboxEvents(tx, OUTBOX_BATCH_SIZE);
      for (const event of events) {
        for (const queue of this.targets.get(event.type) ?? []) {
          await queue.add(event.type, event.payload, { jobId: event.id });
        }
      }
      await tx.outboxEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { publishedAt: this.clock.now() },
      });
      return events.length;
    });
  }

  /** Deletes events published more than 7 days ago (§17.2). */
  async purgePublished(): Promise<number> {
    const { count } = await this.prisma.outboxEvent.deleteMany({
      where: { publishedAt: { lt: new Date(this.clock.now().getTime() - RETENTION_MS) } },
    });
    return count;
  }

  private async poll(): Promise<void> {
    const { signal } = this.stopping;
    while (!signal.aborted) {
      let published = 0;
      try {
        published = await this.publishPending();
      } catch (error) {
        // PostgreSQL or Valkey is unavailable; the events stay in the outbox (§17.2).
        this.logger.warn(`Outbox events not published: ${String(error)}`);
      }
      if (published < OUTBOX_BATCH_SIZE) {
        await sleep(OUTBOX_POLL_INTERVAL_MS, undefined, { signal }).catch(() => undefined);
      }
    }
  }
}
