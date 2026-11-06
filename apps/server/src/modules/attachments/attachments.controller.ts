import { Controller, HttpStatus, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';
import {
  type AttachmentList,
  attachmentListSchema,
  MAX_FILES_PER_UPLOAD,
} from '@trybun/contracts/attachments';
import { CurrentPrincipal } from '../../platform/authentication/current-principal.decorator.js';
import type { Principal } from '../../platform/authentication/principal.js';
import { ResponseSchema } from '../../platform/http/response-schema.decorator.js';
import { AttachmentFilesInterceptor, FILES_FIELD } from './attachment-files.interceptor.js';
import { AttachmentsService } from './attachments.service.js';
import { quarantinedFiles } from './quarantine-storage.engine.js';

@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  /**
   * Uploads 1–10 files as drafts of the principal into quarantine (§13.3, ADR 0008), all or
   * nothing; they are scanned before they become available.
   */
  @Post()
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
}
