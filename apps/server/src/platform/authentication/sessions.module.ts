import { Module } from '@nestjs/common';
import { SessionsService } from './sessions.service.js';

/** The web sessions (§14.4), ended by the feature modules whose changes end them. */
@Module({
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
