import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LogContext } from '../../platform/logging/log-context.js';
import { AUDIT_LOG_ENTRIES_QUEUE } from './audit-log-entries.jobs.js';
import { AuditLogEntriesService } from './audit-log-entries.service.js';

/** The recurring removal of expired IP addresses of the audit log (§13.2). */
@Processor(AUDIT_LOG_ENTRIES_QUEUE)
export class AuditLogEntriesProcessor extends WorkerHost {
  constructor(
    private readonly auditLog: AuditLogEntriesService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => this.auditLog.expireIpAddresses());
  }
}
