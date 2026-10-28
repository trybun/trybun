import { Module } from '@nestjs/common';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

/**
 * Organizations, their e-mail domains, project access and members (§7.3); only the
 * Administrator manages them (§7.5).
 */
@Module({
  imports: [AuditLogEntriesModule],
  controllers: [OrganizationsController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
