import { Module } from '@nestjs/common';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { SetupController } from './setup.controller.js';
import { SetupService } from './setup.service.js';

/** The first-run wizard and the setup token (§15.6). */
@Module({
  imports: [AuditLogEntriesModule],
  controllers: [SetupController],
  providers: [SetupService],
  exports: [SetupService],
})
export class SetupModule {}
