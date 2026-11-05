import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { TicketUnassignmentService } from './ticket-unassignment.service.js';
import { UNASSIGN_DEACTIVATED_USER_QUEUE, UNASSIGN_REMOVED_MEMBER_QUEUE } from './tickets.jobs.js';
import {
  UnassignDeactivatedUserProcessor,
  UnassignRemovedMemberProcessor,
} from './tickets.processor.js';

/**
 * The jobs of tickets (§7.4), imported only by the Worker: the open tickets of a deactivated or
 * removed team member are unassigned. It depends on projects and users for the share locks of the
 * membership and the account.
 */
@Module({
  imports: [
    ActivityEventsModule,
    ProjectsModule,
    UsersModule,
    BullModule.registerQueue(
      { name: UNASSIGN_DEACTIVATED_USER_QUEUE },
      { name: UNASSIGN_REMOVED_MEMBER_QUEUE },
    ),
  ],
  providers: [
    TicketUnassignmentService,
    UnassignDeactivatedUserProcessor,
    UnassignRemovedMemberProcessor,
  ],
})
export class TicketsWorkerModule {}
