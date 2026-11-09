import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { AttachmentLinksService } from './attachment-links.service.js';

/**
 * The links of attachments to tickets and comments (§3.2, S1-12), imported by the modules whose use
 * cases link them or delete a comment with its attachments.
 */
@Module({
  imports: [OutboxModule],
  providers: [AttachmentLinksService],
  exports: [AttachmentLinksService],
})
export class AttachmentLinksModule {}
