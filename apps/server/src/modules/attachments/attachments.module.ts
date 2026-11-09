import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { ActivityEventsModule } from '../activity-events/activity-events.module.js';
import { ProjectsModule } from '../projects/projects.module.js';
import { UsersModule } from '../users/users.module.js';
import { AttachmentLinksModule } from './attachment-links.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { QuarantineStorageEngine } from './quarantine-storage.engine.js';

/**
 * Attachments (§13.3, ADR 0008): the upload of drafts into the quarantine of the object storage,
 * reading, downloading, linking to tickets and deleting. It depends on users for the row lock of
 * the draft quota, on projects for their share lock and on activity events; the object storage is
 * a global platform module.
 */
@Module({
  imports: [ActivityEventsModule, AttachmentLinksModule, OutboxModule, ProjectsModule, UsersModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, QuarantineStorageEngine],
})
export class AttachmentsModule {}
