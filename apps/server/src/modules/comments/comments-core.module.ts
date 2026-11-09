import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { AttachmentLinksModule } from '../attachments/attachment-links.module.js';
import { CommentsService } from './comments.service.js';

/**
 * The comment services without endpoints (§18.3, S1-12): imported by the tickets module – also in
 * the Worker, which loads no controller – and by `CommentsModule`. It depends on activity events
 * and the attachment links, never on tickets (tickets → comments, Q11).
 */
@Module({
  imports: [ActivityEventsModule, AttachmentLinksModule],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsCoreModule {}
