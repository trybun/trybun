import { type DynamicModule, Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { destination, type DestinationStream } from 'pino';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { LogContext } from './log-context.js';
import { loggerOptions } from './logger-options.js';

/** Where the JSON logs go: standard output, collected by Docker (§15.9). */
export const LOG_DESTINATION = 'LOG_DESTINATION';

/**
 * Structured JSON logging with `nestjs-pino` (§14.2, §17.2) for the API, the Worker and the command
 * line; services inject `PinoLogger` with `@InjectPinoLogger(<Class>.name)`. `forRoot()` is called
 * when the root module is built, after every `@InjectPinoLogger()` has registered its context.
 */
@Global()
@Module({})
export class LoggingModule {
  static forRoot(): DynamicModule {
    return {
      module: LoggingModule,
      imports: [
        LoggerModule.forRootAsync({
          providers: [{ provide: LOG_DESTINATION, useFactory: () => destination(1) }],
          inject: [TRYBUN_CONFIG, LOG_DESTINATION],
          useFactory: (config: TrybunConfig, stream: DestinationStream) => ({
            pinoHttp: [loggerOptions(config), stream],
          }),
        }),
      ],
      providers: [LogContext],
      exports: [LogContext],
    };
  }
}
