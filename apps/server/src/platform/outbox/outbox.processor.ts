import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LogContext } from '../logging/log-context.js';
import { OutboxPublisherService } from './outbox-publisher.service.js';
import { OUTBOX_QUEUE } from './outbox.jobs.js';

/** The recurring purge of published events (§17.2). */
@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  constructor(
    private readonly publisher: OutboxPublisherService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => this.publisher.purgePublished());
  }
}
