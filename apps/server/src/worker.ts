import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { readConfig } from './platform/config/config.module.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap(): Promise<void> {
  const config = readConfig();
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(config), {
    abortOnError: false,
    bufferLogs: true,
  });
  // The logs of NestJS itself become JSON lines too (§17.2).
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  app.get(Logger).log('Worker started');
}

bootstrap().catch((error: unknown) => {
  // Before the application exists, e.g. an invalid configuration: its message names no personal data.
  new NestLogger('Worker').error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
