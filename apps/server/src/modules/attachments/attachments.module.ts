import { Module } from '@nestjs/common';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import { UsersModule } from '../users/users.module.js';
import { AttachmentsController } from './attachments.controller.js';
import { AttachmentsService } from './attachments.service.js';
import { QuarantineStorageEngine } from './quarantine-storage.engine.js';

/**
 * Attachments (§13.3, ADR 0008): the upload of drafts into the quarantine of the object storage.
 * It depends on users for the row lock of the draft quota; the object storage is a global platform
 * module.
 */
@Module({
  imports: [OutboxModule, UsersModule],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, QuarantineStorageEngine],
})
export class AttachmentsModule {}
