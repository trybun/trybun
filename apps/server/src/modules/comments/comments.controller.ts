import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type CommentPage,
  commentPageSchema,
  type CommentParams,
  commentParamsSchema,
  type CommentResponse,
  commentResponseSchema,
  type ListCommentsQuery,
  listCommentsQuerySchema,
  type ListTimelineQuery,
  listTimelineQuerySchema,
  type MentionCandidatePage,
  mentionCandidatePageSchema,
  type MentionCandidatesDto,
  mentionCandidatesSchema,
  type TimelinePage,
  timelinePageSchema,
  type UpdateCommentDto,
  updateCommentSchema,
} from '@trybun/contracts/comments';
import {
  type ContentRevisionPage,
  contentRevisionPageSchema,
  type ListContentRevisionsQuery,
  listContentRevisionsQuerySchema,
} from '@trybun/contracts/content-revisions';
import { ApiNoContentResponse } from '@nestjs/swagger';
import { type TicketParams, ticketParamsSchema } from '@trybun/contracts/tickets';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { ExpectedVersion } from '../../platform/http/expected-version.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { TICKET } from '../tickets/tickets.abilities.js';
import { COMMENT } from './comments.abilities.js';
import { CommentsService } from './comments.service.js';

/**
 * The comments of tickets (§6.1, S1-12): the lists of a ticket and a single comment. Adding a
 * comment is an endpoint of the tickets module, which locks the ticket (Q11).
 */
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  /** The comments of a ticket the principal reads, oldest first. */
  @Get('tickets/:ticketId/comments')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read' })
  @ResponseSchema(commentPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Query({ schema: listCommentsQuerySchema }) query: ListCommentsQuery,
  ): Promise<CommentPage> {
    return this.comments.list(principal, ticketId, query);
  }

  /** The comments and the activity events of a ticket in one list, oldest first (Q11). */
  @Get('tickets/:ticketId/timeline')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read' })
  @ResponseSchema(timelinePageSchema)
  timeline(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Query({ schema: listTimelineQuerySchema }) query: ListTimelineQuery,
  ): Promise<TimelinePage> {
    return this.comments.timeline(principal, ticketId, query);
  }

  /**
   * The people a comment being written may mention (§7.3, S1-12 Q4): free text in the body, never
   * in the URL (§17.2).
   */
  @Post('tickets/:ticketId/mention-candidates')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'add_comment' })
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(mentionCandidatePageSchema)
  mentionCandidates(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: mentionCandidatesSchema }) input: MentionCandidatesDto,
  ): Promise<MentionCandidatePage> {
    return this.comments.mentionCandidates(principal, ticketId, input);
  }

  /** A comment the principal reads. */
  @Get('comments/:commentId')
  @TargetRecord({ subject: COMMENT, param: 'commentId', action: 'read' })
  @ResponseSchema(commentResponseSchema)
  get(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: commentParamsSchema }) { commentId }: CommentParams,
  ): Promise<CommentResponse> {
    return this.comments.get(principal, commentId);
  }

  /** Edits the own comment or note; the replaced text becomes a revision (§6.1). */
  @Patch('comments/:commentId')
  @TargetRecord({ subject: COMMENT, param: 'commentId', action: 'update' })
  @ResponseSchema(commentResponseSchema)
  update(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: commentParamsSchema }) { commentId }: CommentParams,
    @Body({ schema: updateCommentSchema }) input: UpdateCommentDto,
    @ExpectedVersion() version: number,
  ): Promise<CommentResponse> {
    return this.comments.update(principal, { id: commentId, version }, input);
  }

  /** Deletes a comment with its revisions, mentions and attachments (§6.1). */
  @Delete('comments/:commentId')
  @TargetRecord({ subject: COMMENT, param: 'commentId', action: 'delete' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: commentParamsSchema }) { commentId }: CommentParams,
    @ExpectedVersion() version: number,
  ): Promise<void> {
    return this.comments.delete(principal, { id: commentId, version });
  }

  /** The earlier versions of a comment, newest first (§6.1, S1-12 Q3). */
  @Get('comments/:commentId/revisions')
  @TargetRecord({ subject: COMMENT, param: 'commentId', action: 'read_revisions' })
  @ResponseSchema(contentRevisionPageSchema)
  listRevisions(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: commentParamsSchema }) { commentId }: CommentParams,
    @Query({ schema: listContentRevisionsQuerySchema }) query: ListContentRevisionsQuery,
  ): Promise<ContentRevisionPage> {
    return this.comments.listRevisions(principal, commentId, query);
  }
}
