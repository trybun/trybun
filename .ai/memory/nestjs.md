# NestJS – validation, serialization and OpenAPI pitfalls

Non-obvious behaviour of NestJS 12 and its ecosystem, found when the validation approach was chosen (October 2026). Decision: [§14.2](../../docs/spec/14-architecture.md), [§14.5](../../docs/spec/14-architecture.md); patterns: [§18.3](../../docs/spec/18-code-patterns.md).

- `StandardSchemaValidationPipe` validates only parameters that declare a `schema`. A `@Body()`, `@Query()`, `@Param()` or `@MessageBody()` without it passes through **unvalidated**; parameters of custom `createParamDecorator()` decorators are skipped unless `validateCustomDecorators: true`.
- The pipe returns `400` by default; the project needs `errorHttpStatusCode: 422` and one `exceptionFactory` producing `errors[]` ([§17.2](../../docs/spec/17-conventions.md)). With the default `transform: true` the handler receives the schema's output (defaults, coercion, stripped keys).
- `StandardSchemaSerializerInterceptor` applies the schema to **each element** of an array response, so `@SerializeOptions({ schema })` takes the item schema. A page envelope (`{ items, nextCursor }`) is an object and needs the envelope schema – to be confirmed with the first list endpoint (S1-01). A response that does not match its schema returns `500`; `StreamableFile`, primitives and `null` pass through unchanged.
- Verified in S0-01 (`apps/server/src/platform/http/http.module.spec.ts`): 422 with `errors[]`, stripping of fields outside the response schema, `500` on a mismatch (logged by the `ExceptionsHandler` as `Serialization failed`), request and response in the OpenAPI document.
- `@nestjs/swagger` 12 converts Zod ≥ 4.2 schemas without configuration (Standard JSON Schema). Responses are documented with `@ApiResponse({ standardSchema })` – the field exists in the types but not in the documentation; `@SerializeOptions` alone does not document a response.
- Ecosystem support of NestJS 12 in October 2026: `nestjs-pino`, `@nestjs/bullmq`, `@nestjs/throttler`, `nestjs-cls` – yes; `nestjs-zod` 5.5 (peers up to NestJS 11 and `@nestjs/swagger` 11) and `@nest-lab/throttler-storage-redis` 1.2.0 (jmcdo29/nest-lab#75) – no.
- The NestJS 12 CLI deprecates webpack in favour of `--builder rspack`. Jest loads the ESM-only NestJS 12 packages only on Node.js 24.9+; the project uses Vitest.

## nestjs-pino 5 and the request pipeline (S0-17)

- `@InjectPinoLogger(<Class>.name)` registers its provider token when the decorator runs; `LoggerModule.forRoot()` collects the tokens **when it is called**. A static `@Module({ imports: [LoggerModule.forRoot…()] })` is evaluated before later imported files, so their tokens are missing ("can't resolve PinoLogger:<Class>"). `LoggingModule.forRoot()` is therefore called while the root module is built.
- nestjs-pino builds **one pino-http instance per process** (`rootLogger.js`); the first application wins. A test that captures log lines overrides `LOG_DESTINATION` and uses one destination for all apps of its file (Vitest isolates files).
- pino-http binds the `req` serializer to the request logger in the middleware, before routing, so `req.route` is still the middleware's (`/api/v1{/*splat}`). The route template is added at completion with `customSuccessObject` / `customErrorObject`.
- With `wrapSerializers` (default) the `err` serializer receives the output of the standard serializer (`type` = constructor name, `message`, `stack`), not the `Error`.
- `quietReqLogger: true` with `customAttributeKeys.reqId = 'requestId'` binds only `requestId` to the logs of a request; `PinoLogger.logger.bindings().requestId` reads it back (`LogContext.requestId()`). `PinoLogger.runInContext(fn, { bindings })` gives jobs the same context.
- NestJS turns body-parser errors (invalid JSON) into a `400` `HttpException` that reaches the global exception filter; unknown routes are a `NotFoundException`.
- Custom parameter decorators (`@ExpectedVersion()`) are resolved with the other parameters after guards and interceptors, so the target record guard (`404`) always runs before them.
