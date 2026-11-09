import { Module } from '@nestjs/common';
import { CommentsCoreModule } from './comments-core.module.js';
import { CommentsController } from './comments.controller.js';

/** The endpoints of comments (§6.1, S1-12), imported only by the API. */
@Module({
  imports: [CommentsCoreModule],
  controllers: [CommentsController],
})
export class CommentsModule {}
