import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { readConfig } from './platform/config/config.module.js';
import { WorkerModule } from './worker.module.js';

const logger = new Logger('Worker');

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), {
    abortOnError: false,
  });
  app.enableShutdownHooks();
  logger.log('Worker started');
}

bootstrap().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
