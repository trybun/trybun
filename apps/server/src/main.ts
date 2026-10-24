import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { ApiModule } from './api.module.js';
import { readConfig } from './platform/config/config.module.js';
import { API_PREFIX, UNPREFIXED_ROUTES } from './platform/http/api-prefix.js';

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.create(ApiModule.forRoot(config), {
    abortOnError: false,
    bufferLogs: true,
  });
  // The logs of NestJS itself become JSON lines too (§17.2).
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  app.enableShutdownHooks();
  await app.listen(config.apiPort);
  app.get(Logger).log({ port: config.apiPort }, 'API listening');
}

bootstrap().catch((error: unknown) => {
  // Before the application exists, e.g. an invalid configuration: its message names no personal data.
  new NestLogger('Api').error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
