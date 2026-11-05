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
  type TicketPage,
  ticketPageSchema,
  type TicketParams,
  ticketParamsSchema,
  type TicketResponse,
  ticketResponseSchema,
  type UpdateTicketDto,
  updateTicketSchema,
} from '@trybun/contracts/tickets';
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
