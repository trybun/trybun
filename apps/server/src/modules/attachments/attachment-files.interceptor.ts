import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { MAX_FILES_PER_UPLOAD } from '@trybun/contracts/attachments';
import type { Request, Response } from 'express';
import multer, { MulterError } from 'multer';
import type { Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../platform/authentication/authentication.guard.js';
import { AppError } from '../../platform/errors/app-error.js';
import { AttachmentsService, type UploadLimits } from './attachments.service.js';
import { draftLimitReached } from './domain/draft-quota.js';
import { QuarantineStorageEngine } from './quarantine-storage.engine.js';

/** The multipart field of the files of an upload (§13.3). */
export const FILES_FIELD = 'files';

/** A JSON Pointer to a field of the request (RFC 6901). */
function pointerTo(field: string): string {
  return `/${field.replaceAll('~', '~0').replaceAll('/', '~1')}`;
}

/** The error of the API for a failure of multer or of the multipart parser. */
function uploadError(error: unknown, limits: UploadLimits): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (!(error instanceof MulterError)) {
    // The parser refused the body, or the client aborted it.
    return new AppError('request.malformed');
  }
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return limits.isLimitedByQuota ? draftLimitReached() : new AppError('request.too_large');
    case 'LIMIT_FILE_COUNT':
      return new AppError('request.validation_failed', [
        { pointer: pointerTo(FILES_FIELD), code: 'array.too_long' },
      ]);
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError('request.validation_failed', [
        error.field === FILES_FIELD || error.field === undefined
          ? { pointer: pointerTo(FILES_FIELD), code: 'array.too_long' }
          : { pointer: pointerTo(error.field), code: 'field.unrecognized' },
      ]);
    default:
      // Text fields and other parts the upload does not take.
      return new AppError('request.validation_failed');
  }
}

/**
 * Receives the files of `POST /api/v1/attachments` (ADR 0008): multer with the quarantine storage
 * engine streams each file into the object storage while the request arrives, never holding a file
 * in memory. Its limits are those of the principal's request, computed before the first byte is
 * stored: at most 10 files, each at most the configured size and the remaining bytes of the draft
 * quota (Q23). A request over a limit stops while it streams, and multer deletes what it stored.
 * The files reach the handler through `@UploadedFiles()`, without a Zod schema (Q12).
 */
@Injectable()
export class AttachmentFilesInterceptor implements NestInterceptor {
  constructor(
    private readonly attachments: AttachmentsService,
    private readonly storageEngine: QuarantineStorageEngine,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const http = context.switchToHttp();
    const request = http.getRequest<AuthenticatedRequest>();
    const limits = await this.limitsOf(request);
    const receiveFiles = multer({
      storage: this.storageEngine,
      // Browsers send the file name as UTF-8 bytes (WHATWG HTML, multipart/form-data).
      defParamCharset: 'utf8',
      // The whole name reaches the normalization, which replaces path separators (§13.3).
      preservePath: true,
      limits: { fileSize: limits.maxFileSize, files: MAX_FILES_PER_UPLOAD, fields: 0 },
    }).array(FILES_FIELD, MAX_FILES_PER_UPLOAD);
    await new Promise<void>((resolve, reject) => {
      receiveFiles(request, http.getResponse<Response>(), (error?: unknown) => {
        if (error === undefined) {
          resolve();
        } else {
          reject(uploadError(error, limits));
        }
      });
    });
    return next.handle();
  }

  /**
   * The limits of the request. When the upload is refused before its files are read (`403`, the
   * draft quota), the body is read to its end first, as multer does for its own errors: a response
   * sent while the body still streams can reach the browser as a reset connection through the BFF.
   */
  private async limitsOf(request: AuthenticatedRequest): Promise<UploadLimits> {
    try {
      return await this.attachments.uploadLimits(request.principal);
    } catch (error) {
      await drain(request);
      throw error;
    }
  }
}

/** Reads and discards the rest of a request body. */
function drain(request: Request): Promise<void> {
  if (request.readableEnded || request.destroyed) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    request.once('end', resolve).once('close', resolve).once('error', resolve).resume();
  });
}
