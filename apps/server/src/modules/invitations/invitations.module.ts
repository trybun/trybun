import { Module } from '@nestjs/common';
import { AuthenticationModule } from '../../platform/authentication/authentication.module.js';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { InvitationAcceptanceService } from './invitation-acceptance.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';

/**
 * Invitations (§7.4, ADR 0009): issuing with the preview, the direct grant to existing accounts,
 * resending and revoking, and the acceptance that activates the account. Access is granted through
 * the services of the projects and organizations modules.
 */
@Module({
  imports: [
    AuditLogEntriesModule,
    OutboxModule,
    AuthenticationModule,
    ProjectsModule,
    OrganizationsModule,
  ],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationAcceptanceService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
