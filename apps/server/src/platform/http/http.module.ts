import {
  HttpStatus,
  Module,
  StandardSchemaSerializerInterceptor,
  StandardSchemaValidationPipe,
  UnprocessableEntityException,
} from '@nestjs/common';
import { APP_INTERCEPTOR, APP_PIPE, Reflector } from '@nestjs/core';
import { toValidationProblem } from './validation-errors.js';

/**
 * Global validation and serialization of the request pipeline (§18.3): every parameter is
 * validated with its contract schema (422 with `errors[]`), every response is serialized with
 * the schema declared by `@ResponseSchema()`.
 */
@Module({
  providers: [
    {
      provide: APP_PIPE,
      useValue: new StandardSchemaValidationPipe({
        errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        exceptionFactory: (issues) => new UnprocessableEntityException(toValidationProblem(issues)),
      }),
    },
    {
      provide: APP_INTERCEPTOR,
      useFactory: (reflector: Reflector) => new StandardSchemaSerializerInterceptor(reflector),
      inject: [Reflector],
    },
  ],
})
export class HttpModule {}
