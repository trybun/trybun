import { STATUS_CODES } from 'node:http';
import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException } from '@nestjs/common';
import type { ErrorCode } from '@trybun/contracts/errors';
import type { ProblemDetails } from '@trybun/contracts/problem-details';
import type { Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppError } from './app-error.js';

/** Error codes of the exceptions NestJS and Express throw themselves, by HTTP status. */
const FRAMEWORK_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
  400: 'request.malformed',
  401: 'authentication.required',
  403: 'request.forbidden',
  404: 'request.not_found',
  413: 'request.too_large',
};

/** Titles of RFC 9110 where Node.js still uses the older names. */
const TITLES: Partial<Record<number, string>> = {
  413: 'Content Too Large',
  422: 'Unprocessable Content',
};

/** Problem Details (RFC 9457) of an error code (§17.2). */
export function toProblemDetails(error: AppError): ProblemDetails {
  return {
    type: 'about:blank',
    title: TITLES[error.status] ?? STATUS_CODES[error.status] ?? 'Error',
    status: error.status,
    code: error.code,
    ...(error.errors === undefined ? {} : { errors: [...error.errors] }),
  };
}

/**
 * Step 8 of the request pipeline (§18.3): every error becomes Problem Details with a stable code
 * (§17.2). Unexpected errors are logged once, with the request ID, and returned as `500` without
 * details.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(@InjectPinoLogger(ProblemDetailsFilter.name) private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const error = this.toAppError(exception);
    const response = host.switchToHttp().getResponse<Response>();
    if (error.status === 401) {
      // The challenge of RFC 6750; RFC 9470 for a missing second factor.
      response.setHeader(
        'WWW-Authenticate',
        error.code === 'authentication.second_factor_required'
          ? 'Bearer error="insufficient_user_authentication"'
          : 'Bearer',
      );
    }
    response.status(error.status).type('application/problem+json').json(toProblemDetails(error));
  }

  private toAppError(exception: unknown): AppError {
    if (exception instanceof AppError) {
      return exception;
    }
    const code =
      exception instanceof HttpException ? FRAMEWORK_ERROR_CODES[exception.getStatus()] : undefined;
    if (code !== undefined) {
      return new AppError(code);
    }
    this.logger.error({ err: exception }, 'Unexpected error');
    return new AppError('server.internal_error');
  }
}
