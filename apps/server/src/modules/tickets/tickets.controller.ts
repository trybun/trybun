import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import {
  type ActivityEventPage,
  activityEventPageSchema,
  type ListActivityEventsQuery,
  listActivityEventsQuerySchema,
} from '@trybun/contracts/activity-events';
import {
  type ChangeTicketStatusDto,
  changeTicketStatusSchema,
  type ConfirmResolutionDto,
  confirmResolutionSchema,
  type CreateTicketDto,
  createTicketSchema,
  type ListTicketsQuery,
  listTicketsQuerySchema,
  type RejectTicketSharingDto,
  rejectTicketSharingSchema,
  type SetTicketVisibilityDto,
  setTicketVisibilitySchema,
  type TicketPage,
  ticketPageSchema,
  type TicketParams,
  ticketParamsSchema,
  type TicketResponse,
  ticketResponseSchema,
  type UpdateTicketDto,
  updateTicketSchema,
} from '@trybun/contracts/tickets';
import {
  type CommentResponse,
  commentResponseSchema,
  type CreateCommentDto,
  createCommentSchema,
} from '@trybun/contracts/comments';
import {
  type ContentRevisionPage,
  contentRevisionPageSchema,
  type ListContentRevisionsQuery,
  listContentRevisionsQuerySchema,
  type RedactDescriptionDto,
  redactDescriptionSchema,
} from '@trybun/contracts/content-revisions';
import type { Response } from 'express';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { API_PREFIX } from '../../platform/http/api-prefix.js';
import { ExpectedVersion } from '../../platform/http/expected-version.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { TICKET } from './tickets.abilities.js';
import { TicketsService } from './tickets.service.js';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  /** The tickets the principal can see, newest first (§3.2). */
  @Get()
  @ResponseSchema(ticketPageSchema)
  list(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listTicketsQuerySchema }) query: ListTicketsQuery,
  ): Promise<TicketPage> {
    return this.tickets.list(principal, query);
  }

  /** Creates a ticket in a project (§3.2) with the next number of the project. */
  @Post()
  @ResponseSchema(ticketResponseSchema, HttpStatus.CREATED)
  async create(
    @CurrentPrincipal() principal: Principal,
    @Body({ schema: createTicketSchema }) input: CreateTicketDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TicketResponse> {
    const ticket = await this.tickets.create(principal, input);
    response.location(`/${API_PREFIX}/tickets/${ticket.id}`);
    return ticket;
  }

  @Get(':ticketId')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read' })
  @ResponseSchema(ticketResponseSchema)
  findOne(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
  ): Promise<TicketResponse> {
    return this.tickets.findOne(principal, ticketId);
  }

  /**
   * Changes the fields of a ticket; the service checks each field (§18.3). Every action that
   * changes a field implies `update`.
   */
  @Patch(':ticketId')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'update' })
  @ResponseSchema(ticketResponseSchema)
  update(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: updateTicketSchema }) input: UpdateTicketDto,
    @ExpectedVersion() version: number,
  ): Promise<TicketResponse> {
    return this.tickets.update(principal, { id: ticketId, version }, input);
  }

  /**
   * Changes the status of a ticket (§4.3): the reason for `rejected`, the original for
   * `duplicate`; the response carries the actual status, e.g. after the redirect of `done` to the
   * resolution confirmation.
   */
  @Put(':ticketId/status')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'change_status' })
  @ResponseSchema(ticketResponseSchema)
  changeStatus(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: changeTicketStatusSchema }) input: ChangeTicketStatusDto,
    @ExpectedVersion() version: number,
  ): Promise<TicketResponse> {
    return this.tickets.changeStatus(principal, { id: ticketId, version }, input);
  }

  /**
   * Changes the visibility of a ticket (§5.3): the service checks `set_visibility_<visibility>` on
   * the locked ticket; for the requester, `all_customers` requests sharing (§5.2).
   */
  @Put(':ticketId/visibility')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read' })
  @ResponseSchema(ticketResponseSchema)
  setVisibility(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: setTicketVisibilitySchema }) input: SetTicketVisibilityDto,
    @ExpectedVersion() version: number,
  ): Promise<TicketResponse> {
    return this.tickets.setVisibility(principal, { id: ticketId, version }, input);
  }

  /** Shares a ticket with all customers on its author's pending request (§5.2). */
  @Post(':ticketId/sharing/approve')
  @HttpCode(HttpStatus.OK)
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'approve_sharing' })
  @ResponseSchema(ticketResponseSchema)
  approveSharing(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @ExpectedVersion() version: number,
  ): Promise<TicketResponse> {
    return this.tickets.decideSharing(principal, { id: ticketId, version }, { approve: true });
  }

  /** Refuses a pending sharing request with a required reason (§5.2). */
  @Post(':ticketId/sharing/reject')
  @HttpCode(HttpStatus.OK)
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'reject_sharing' })
  @ResponseSchema(ticketResponseSchema)
  rejectSharing(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: rejectTicketSharingSchema }) input: RejectTicketSharingDto,
    @ExpectedVersion() version: number,
  ): Promise<TicketResponse> {
    return this.tickets.decideSharing(
      principal,
      { id: ticketId, version },
      { approve: false, ...input },
    );
  }

  /**
   * The requester's answer to "Is your problem solved?" (§4.3). No `If-Match`: the state of the
   * ticket protects the answer, and the first one wins.
   */
  @Post(':ticketId/resolution-confirmation')
  @HttpCode(HttpStatus.OK)
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'confirm_resolution' })
  @ResponseSchema(ticketResponseSchema)
  confirmResolution(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: confirmResolutionSchema }) input: ConfirmResolutionDto,
  ): Promise<TicketResponse> {
    return this.tickets.confirmResolution(principal, ticketId, input);
  }

  /**
   * Adds a comment or an internal note to a ticket (§6.1, S1-12). The guard checks `add_comment`
   * before validation; the service checks `add_internal_note` for a note.
   */
  @Post(':ticketId/comments')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'add_comment' })
  @ResponseSchema(commentResponseSchema, HttpStatus.CREATED)
  async addComment(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: createCommentSchema }) input: CreateCommentDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<CommentResponse> {
    const comment = await this.tickets.addComment(principal, ticketId, input);
    response.location(`/${API_PREFIX}/comments/${comment.id}`);
    return comment;
  }

  /** Redacts the description: the current text is never kept, the listed revisions are deleted. */
  @Post(':ticketId/description-redaction')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'redact_description' })
  @HttpCode(HttpStatus.OK)
  @ResponseSchema(ticketResponseSchema)
  redactDescription(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: redactDescriptionSchema }) input: RedactDescriptionDto,
    @ExpectedVersion() version: number,
  ): Promise<TicketResponse> {
    return this.tickets.redactDescription(principal, { id: ticketId, version }, input);
  }

  /** The earlier versions of the description, newest first (§6.1, S1-12 Q3). */
  @Get(':ticketId/description-revisions')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read_description_revisions' })
  @ResponseSchema(contentRevisionPageSchema)
  listDescriptionRevisions(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Query({ schema: listContentRevisionsQuerySchema }) query: ListContentRevisionsQuery,
  ): Promise<ContentRevisionPage> {
    return this.tickets.listDescriptionRevisions(principal, ticketId, query);
  }

  /** The activity history of a ticket, oldest first (§4.5). */
  @Get(':ticketId/activity-events')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read' })
  @ResponseSchema(activityEventPageSchema)
  listActivityEvents(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Query({ schema: listActivityEventsQuerySchema }) query: ListActivityEventsQuery,
  ): Promise<ActivityEventPage> {
    return this.tickets.listActivityEvents(principal, ticketId, query);
  }
}
