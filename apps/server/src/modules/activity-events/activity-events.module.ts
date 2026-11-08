import { Module } from '@nestjs/common';
import { ActivityEventsService } from './activity-events.service.js';

/**
 * The activity history of tickets (§4.5): the reference implementation of "activity events from
 * the record before and after the change" (§18.9). Its endpoint belongs to the tickets module,
 * which depends on this one, never the other way round.
 */
@Module({
  providers: [ActivityEventsService],
  exports: [ActivityEventsService],
})
export class ActivityEventsModule {}
