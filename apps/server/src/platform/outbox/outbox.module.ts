import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service.js';

/** Imported by the feature modules whose use cases write outbox events (§18.3). */
@Module({
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
