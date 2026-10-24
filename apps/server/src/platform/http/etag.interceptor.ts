import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { type Observable, tap } from 'rxjs';

/** The weak ETag of a version (§17.2). */
export function versionETag(version: number): string {
  return `W/"${version}"`;
}

/**
 * Returns the version of a versioned record as its weak ETag (§17.2): every response whose body
 * is one record with a `version` gets the header, so clients send it back in `If-Match`.
 */
@Injectable()
export class ETagInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap((body) => {
        const version = (body as { version?: unknown } | null | undefined)?.version;
        if (Number.isSafeInteger(version)) {
          context
            .switchToHttp()
            .getResponse<Response>()
            .setHeader('ETag', versionETag(version as number));
        }
      }),
    );
  }
}
