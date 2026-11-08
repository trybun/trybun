import { Module } from '@nestjs/common';
import { AttachmentLinksService } from './attachment-links.service.js';

/** The link of drafts to tickets (§3.2), imported by the modules whose use cases link them. */
@Module({
  providers: [AttachmentLinksService],
  exports: [AttachmentLinksService],
})
export class AttachmentLinksModule {}
