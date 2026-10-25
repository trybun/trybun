import { Module } from '@nestjs/common';
import { AuditLogEntriesService } from './audit-log-entries.service.js';

/** The administrative audit log (§13.5); other modules record their entries through its service. */
@Module({
  providers: [AuditLogEntriesService],
  exports: [AuditLogEntriesService],
})
export class AuditLogEntriesModule {}
