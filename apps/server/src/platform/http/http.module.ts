import {
  HttpStatus,
  Module,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { AppError } from '../errors/app-error.js';
import { ETagInterceptor } from './etag.interceptor.js';
import { toFieldErrors } from './validation-errors.js';

/**
 * Global validation and serialization of the request pipeline (§18.3): every parameter is
 * validated with its contract schema (422 with `errors[]`), every response is serialized with
 * the schema declared by `@ResponseSchema()`, and a versioned record carries its `ETag`.
 */
@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        exceptionFactory: (issues) =>
          new AppError('request.validation_failed', toFieldErrors(issues)),
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => new StandardSchemaSerializerInterceptor(reflector),
      inject: [Reflector],
    },
    { provide: APP_INTERCEPTOR, useClass: ETagInterceptor },
  ],
})
export class HttpModule {}
