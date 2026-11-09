import { Module } from '@nestjs/common';
import { ContentRevisionsService } from './content-revisions.service.js';

/**
 * The earlier versions of descriptions and comments (§6.1, S1-12), imported by the tickets and
 * the comments modules; it imports neither.
 */
@Module({
  providers: [ContentRevisionsService],
  exports: [ContentRevisionsService],
})
export class ContentRevisionsModule {}
