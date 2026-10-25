import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { ApiModule } from './api.module.js';
import { readConfig } from './platform/config/config.module.js';
import { API_PREFIX, UNPREFIXED_ROUTES } from './platform/http/api-prefix.js';
import { TRUSTED_PROXIES } from './platform/http/trusted-proxies.js';

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.create<NestExpressApplication>(ApiModule.forRoot(config), {
    abortOnError: false,
    bufferLogs: true,
  });
  // The logs of NestJS itself become JSON lines too (§17.2).
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  // The client IP of the rate limits comes from the proxies of the internal network (§14.4).
  app.set('trust proxy', TRUSTED_PROXIES);
  app.enableShutdownHooks();
  await app.listen(config.apiPort);
  app.get(Logger).log({ port: config.apiPort }, 'API listening');
}

bootstrap().catch((error: unknown) => {
  // Before the application exists, e.g. an invalid configuration: its message names no personal data.
  new NestLogger('Api').error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
