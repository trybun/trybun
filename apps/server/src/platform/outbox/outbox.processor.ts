import { Processor, WorkerHost } from '@nestjs/bullmq';
import { OutboxPublisherService } from './outbox-publisher.service.js';
import { OUTBOX_QUEUE } from './outbox.jobs.js';

/** The recurring purge of published events (§17.2). */
@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  constructor(private readonly publisher: OutboxPublisherService) {
    super();
  }

  async process(): Promise<void> {
    await this.publisher.purgePublished();
  }
}
