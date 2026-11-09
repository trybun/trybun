import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { AttachmentLinksModule } from '../attachments/attachment-links.module.js';
import { CommentsCoreModule } from '../comments/comments-core.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

/**
 * Tickets (§3.2): their creation with per-project numbers and attachments, their fields, their
 * status (§4.3), their visibility and sharing requests (§5.1–§5.3) and their activity history
 * (§4.5). It imports projects, organizations, users, activity events, the audit log and the
 * attachment links module (`AttachmentLinksModule`), which links drafts to a new ticket; none of
 * these modules imports it. The attachments module uses the ticket rules
 * (`tickets.abilities.ts`) without importing this module, so there is no module cycle.
 */
@Module({
  imports: [
    ActivityEventsModule,
    AuditLogEntriesModule,
    AttachmentLinksModule,
    CommentsCoreModule,
    OrganizationsModule,
    OutboxModule,
    ProjectsModule,
    UsersModule,
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
