import { Controller, Get, Param, Query } from '@nestjs/common';
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
  type TimelinePage,
  timelinePageSchema,
} from '@trybun/contracts/comments';
import { type TicketParams, ticketParamsSchema } from '@trybun/contracts/tickets';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
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
}
