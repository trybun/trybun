import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { AUDIT_LOG_ENTRIES_QUEUE, AUDIT_LOG_IP_EXPIRY_JOB } from './audit-log-entries.jobs.js';
import { AuditLogEntriesModule } from './audit-log-entries.module.js';
import { AuditLogEntriesProcessor } from './audit-log-entries.processor.js';

const IP_EXPIRY_INTERVAL_MS = 60 * 60 * 1_000;

/** The recurring work of the audit log (§13.2), imported only by the Worker. */
@Module({
  imports: [BullModule.registerQueue({ name: AUDIT_LOG_ENTRIES_QUEUE }), AuditLogEntriesModule],
  providers: [AuditLogEntriesProcessor],
})
export class AuditLogEntriesWorkerModule implements OnApplicationBootstrap {
  constructor(@InjectQueue(AUDIT_LOG_ENTRIES_QUEUE) private readonly queue: Queue) {}

  /** One run per interval regardless of the number of Worker replicas (§17.2). */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      AUDIT_LOG_IP_EXPIRY_JOB,
      { every: IP_EXPIRY_INTERVAL_MS },
      { name: AUDIT_LOG_IP_EXPIRY_JOB },
    );
  }
}
