import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ApiModule } from './api.module.js';
import { readConfig } from './platform/config/config.module.js';
import { API_PREFIX } from './platform/http/api-prefix.js';

const logger = new Logger('Api');

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.create(ApiModule.forRoot(config), { abortOnError: false });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  await app.listen(config.apiPort);
  logger.log(`API listening on port ${config.apiPort}`);
}

bootstrap().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
