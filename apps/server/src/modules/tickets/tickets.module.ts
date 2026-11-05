import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsService } from './tickets.service.js';

/**
 * Tickets (§3.2): their creation with per-project numbers, their fields, their status (§4.3) and
 * their activity history (§4.5). It depends on projects, organizations, users and activity events; none of them
 * depends on it.
 */
@Module({
  imports: [ActivityEventsModule, OrganizationsModule, OutboxModule, ProjectsModule, UsersModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
