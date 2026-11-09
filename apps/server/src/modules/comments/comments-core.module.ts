import { Module } from '@nestjs/common';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { AttachmentLinksModule } from '../attachments/attachment-links.module.js';
import { ContentRevisionsModule } from '../content-revisions/content-revisions.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { CommentsService } from './comments.service.js';

/**
 * The comment services without endpoints (§18.3, S1-12): imported by the tickets module – also in
 * the Worker, which loads no controller – and by `CommentsModule`. It depends on activity events
 * the attachment links, the content revisions and the projects (their share lock), never on
 * tickets (tickets → comments, Q11).
 */
@Module({
  imports: [ActivityEventsModule, AttachmentLinksModule, ContentRevisionsModule, ProjectsModule],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsCoreModule {}
