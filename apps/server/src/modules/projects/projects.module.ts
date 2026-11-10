import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { InvitationRevocationsModule } from '../invitations/invitation-revocations.module.js';
import { ProjectMembersController } from './project-members.controller.js';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';

/**
 * Projects, their settings, archiving and members (§3.1, §7.3, §7.4): the reference of a feature
 * module with endpoints, a list, a form and mutations (§18.9).
 */
@Module({
  imports: [AuditLogEntriesModule, InvitationRevocationsModule, OutboxModule],
  controllers: [ProjectsController, ProjectMembersController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
