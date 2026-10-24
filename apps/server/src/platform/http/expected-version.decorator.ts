import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AppError } from '../errors/app-error.js';

/** A weak or strong ETag of a version (§17.2); the API sends the weak form `W/"<version>"`. */
const VERSION_ETAG = /^(?:W\/)?"(\d{1,15})"$/;

/**
 * The version a change of a versioned record expects, from `If-Match` (§17.2): a missing header
 * returns `428`. `*` would match any version, so it counts as missing. A value that is not the
 * ETag of a version can never match and returns `412`, as a stale version does.
 */
export function parseIfMatch(header: string | undefined): number {
  const value = header?.trim() ?? '';
  if (value === '' || value === '*') {
    throw new AppError('request.precondition_required');
  }
  const version = VERSION_ETAG.exec(value)?.[1];
  if (version === undefined) {
    throw new AppError('request.precondition_failed');
  }
  return Number(version);
}

/**
 * The expected version of the handler's record (§18.3, step 4): `PATCH`, `PUT` and `DELETE` of a
 * versioned record declare it and pass it to the service, whose conditional update returns `412`
 * for a stale one. It is resolved after the target record guard, so an invisible record returns
 * `404` whatever the header.
 */
export const ExpectedVersion = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  parseIfMatch(context.switchToHttp().getRequest<Request>().headers['if-match']),
);
