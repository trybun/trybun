import { BullModule, getQueueToken, InjectQueue } from '@nestjs/bullmq';
import { type DynamicModule, Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { OUTBOX_TARGETS, OutboxPublisherService } from './outbox-publisher.service.js';
import { OUTBOX_PURGE_JOB, OUTBOX_QUEUE, type OutboxSubscription } from './outbox.jobs.js';
import { OutboxProcessor } from './outbox.processor.js';

const PURGE_INTERVAL_MS = 60 * 60 * 1_000;

/**
 * The outbox publisher and its recurring purge (§17.2), imported only by the Worker. The Worker
 * passes the subscriptions of its feature worker modules.
 */
@Module({})
export class OutboxWorkerModule implements OnApplicationBootstrap {
  constructor(@InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue) {}

  static forRoot(subscriptions: readonly OutboxSubscription[]): DynamicModule {
    const queueNames = [...new Set(subscriptions.map((subscription) => subscription.queue))];
    return {
      module: OutboxWorkerModule,
      imports: [
        BullModule.registerQueue(...[OUTBOX_QUEUE, ...queueNames].map((name) => ({ name }))),
      ],
      providers: [
        OutboxPublisherService,
        OutboxProcessor,
        {
          provide: OUTBOX_TARGETS,
          inject: queueNames.map((name) => getQueueToken(name)),
          useFactory: (...queues: Queue[]) => targetsByEventType(subscriptions, queues),
        },
      ],
    };
  }

  /** One run per interval regardless of the number of Worker replicas (§17.2). */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      OUTBOX_PURGE_JOB,
      { every: PURGE_INTERVAL_MS },
      { name: OUTBOX_PURGE_JOB },
    );
  }
}

function targetsByEventType(
  subscriptions: readonly OutboxSubscription[],
  queues: readonly Queue[],
): Map<string, Queue[]> {
  const queueByName = new Map(queues.map((queue) => [queue.name, queue]));
  const targets = new Map<string, Queue[]>();
  for (const { queue, eventTypes } of subscriptions) {
    for (const eventType of eventTypes) {
      const target = queueByName.get(queue);
      if (target !== undefined) {
        targets.set(eventType, [...(targets.get(eventType) ?? []), target]);
      }
    }
  }
  return targets;
}
