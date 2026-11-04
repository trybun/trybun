import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

/**
 * Tickets (§3.2): their creation with per-project numbers, their fields and their activity
 * history (§4.5). It depends on projects, users and activity events; none of them depends on it.
 */
@Module({
  imports: [ActivityEventsModule, ProjectsModule, UsersModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
