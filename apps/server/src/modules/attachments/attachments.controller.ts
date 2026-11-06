import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiHeader,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import {
  type AddTicketAttachmentsDto,
  addTicketAttachmentsSchema,
  type Attachment,
  type AttachmentList,
  attachmentListSchema,
  type AttachmentPage,
  attachmentPageSchema,
  type AttachmentParams,
  attachmentParamsSchema,
  attachmentSchema,
  type ListAttachmentsQuery,
  listAttachmentsQuerySchema,
  type ListTicketAttachmentsQuery,
  listTicketAttachmentsQuerySchema,
  MAX_FILES_PER_UPLOAD,
} from '@trybun/contracts/attachments';
import { type TicketParams, ticketParamsSchema } from '@trybun/contracts/tickets';
import type { Response } from 'express';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { TargetRecord } from '../../platform/authorization/target-record.decorator.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { TICKET } from '../tickets/tickets.abilities.js';
import { AttachmentFilesInterceptor, FILES_FIELD } from './attachment-files.interceptor.js';
import { ATTACHMENT } from './attachments.abilities.js';
import { AttachmentsService } from './attachments.service.js';
import { FORCED_CONTENT_HEADERS } from './domain/content-response.js';
import { quarantinedFiles } from './quarantine-storage.engine.js';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /**
   * Uploads 1–10 files as drafts of the principal into quarantine (§13.3, ADR 0008), all or
   * nothing; they are scanned before they become available.
   */
  @Post('attachments')
  @UseInterceptors(AttachmentFilesInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [FILES_FIELD],
      properties: {
        [FILES_FIELD]: {
          type: 'array',
          minItems: 1,
          maxItems: MAX_FILES_PER_UPLOAD,
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ResponseSchema(attachmentListSchema, HttpStatus.CREATED)
  upload(
    @CurrentPrincipal() principal: Principal,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
  ): Promise<AttachmentList> {
    return this.attachments.upload(principal, quarantinedFiles(files ?? []));
  }

  /**
   * The attachments with these IDs the principal can read (§18.4: a list bounded by the IDs of
   * the request); unknown and invisible IDs are left out.
   */
  @Get('attachments')
  @ResponseSchema(attachmentPageSchema)
  listByIds(
    @CurrentPrincipal() principal: Principal,
    @Query({ schema: listAttachmentsQuerySchema }) query: ListAttachmentsQuery,
  ): Promise<AttachmentPage> {
    return this.attachments.listByIds(principal, query);
  }

  @Get('attachments/:attachmentId')
  @TargetRecord({ subject: ATTACHMENT, param: 'attachmentId', action: 'read' })
  @ResponseSchema(attachmentSchema)
  findOne(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: attachmentParamsSchema }) { attachmentId }: AttachmentParams,
  ): Promise<Attachment> {
    return this.attachments.findOne(principal, attachmentId);
  }

  /**
   * The file of an available attachment (§13.3, ADR 0008), streamed from the storage with forced
   * headers: raster images inline, every other file as a download. `409` while it is checked,
   * `410` once it was removed; `304` for a current copy of the client.
   */
  @Get('attachments/:attachmentId/content')
  @TargetRecord({ subject: ATTACHMENT, param: 'attachmentId', action: 'read' })
  @ApiHeader({ name: 'If-None-Match', required: false })
  @ApiOkResponse({ content: { '*/*': { schema: { type: 'string', format: 'binary' } } } })
  @ApiResponse({ status: HttpStatus.NOT_MODIFIED })
  async content(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: attachmentParamsSchema }) { attachmentId }: AttachmentParams,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Headers('if-modified-since') ifModifiedSince: string | undefined,
    @Headers('cache-control') cacheControl: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile | undefined> {
    const { etag, file } = await this.attachments.content(principal, attachmentId, {
      ifNoneMatch,
      ifModifiedSince,
      cacheControl,
    });
    response.set({ ...FORCED_CONTENT_HEADERS, ETag: etag });
    if (file === null) {
      // NestJS sends the status of the route; Express answers an empty body of a request that is
      // fresh against the ETag with `304` itself (`req.fresh`), by the rule of `isNotModified`.
      return undefined;
    }
    return new StreamableFile(file.body, {
      type: file.contentType,
      disposition: file.disposition,
      length: file.size,
    });
  }

  /**
   * Deletes an attachment (§13.3); its objects are deleted by the Worker. No `If-Match`:
   * attachments never change through the API (§17.2).
   */
  @Delete('attachments/:attachmentId')
  @TargetRecord({ subject: ATTACHMENT, param: 'attachmentId', action: 'delete' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  delete(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: attachmentParamsSchema }) { attachmentId }: AttachmentParams,
  ): Promise<void> {
    return this.attachments.delete(principal, attachmentId);
  }

  /** The attachments of a ticket, oldest first (§3.2). */
  @Get('tickets/:ticketId/attachments')
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'read' })
  @ResponseSchema(attachmentPageSchema)
  listOfTicket(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Query({ schema: listTicketAttachmentsQuerySchema }) query: ListTicketAttachmentsQuery,
  ): Promise<AttachmentPage> {
    return this.attachments.listOfTicket(principal, ticketId, query);
  }

  /**
   * Links the principal's own drafts to a ticket (§3.2, Q4); the ticket's version does not change
   * (§17.2).
   */
  @Post('tickets/:ticketId/attachments')
  @HttpCode(HttpStatus.OK)
  @TargetRecord({ subject: TICKET, param: 'ticketId', action: 'add_attachment' })
  @ResponseSchema(attachmentListSchema)
  addToTicket(
    @CurrentPrincipal() principal: Principal,
    @Param({ schema: ticketParamsSchema }) { ticketId }: TicketParams,
    @Body({ schema: addTicketAttachmentsSchema }) input: AddTicketAttachmentsDto,
  ): Promise<AttachmentList> {
    return this.attachments.addToTicket(principal, ticketId, input);
  }
}
