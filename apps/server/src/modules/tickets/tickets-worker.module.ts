import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { AuditLogEntriesModule } from '../audit-log-entries/audit-log-entries.module.js';
import { AttachmentLinksModule } from '../attachments/attachment-links.module.js';
import { CommentsCoreModule } from '../comments/comments-core.module.js';
import { ContentRevisionsModule } from '../content-revisions/content-revisions.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { TicketUnassignmentService } from './ticket-unassignment.service.js';
import {
  CLOSE_UNCONFIRMED_RESOLUTION_QUEUE,
  SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_QUEUE,
  UNASSIGN_DEACTIVATED_USER_QUEUE,
  UNASSIGN_REMOVED_MEMBER_QUEUE,
} from './tickets.jobs.js';
import {
  CloseUnconfirmedResolutionProcessor,
  ScheduleResolutionConfirmationCloseProcessor,
  UnassignDeactivatedUserProcessor,
  UnassignRemovedMemberProcessor,
} from './tickets.processor.js';
import { TicketsService } from './tickets.service.js';

/**
 * The jobs of tickets, imported only by the Worker: the open tickets of a deactivated or removed
 * team member are unassigned (§7.4), and a ticket whose requester does not confirm its resolution
 * closes after 7 days (§4.3) through the status use case of the API. It depends on projects and
 * users for the share locks of the membership and the account, and on the modules the tickets
 * service needs.
 */
@Module({
  imports: [
    ActivityEventsModule,
    AuditLogEntriesModule,
    AttachmentLinksModule,
    CommentsCoreModule,
    ContentRevisionsModule,
    OrganizationsModule,
    OutboxModule,
    ProjectsModule,
    UsersModule,
    BullModule.registerQueue(
      { name: UNASSIGN_DEACTIVATED_USER_QUEUE },
      { name: UNASSIGN_REMOVED_MEMBER_QUEUE },
      { name: SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_QUEUE },
      { name: CLOSE_UNCONFIRMED_RESOLUTION_QUEUE },
    ),
  ],
  providers: [
    TicketsService,
    TicketUnassignmentService,
    UnassignDeactivatedUserProcessor,
    UnassignRemovedMemberProcessor,
    ScheduleResolutionConfirmationCloseProcessor,
    CloseUnconfirmedResolutionProcessor,
  ],
})
export class TicketsWorkerModule {}
