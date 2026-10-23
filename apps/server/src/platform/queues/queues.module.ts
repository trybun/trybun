import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { DEFAULT_JOB_OPTIONS } from './job-options.js';

/**
 * BullMQ on Valkey (§14.2, §17.2), imported only by the Worker. Queues are registered by the
 * worker modules that own them (§18.3).
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [TRYBUN_CONFIG],
      useFactory: (config: TrybunConfig) => ({
        connection: { url: config.valkeyUrl },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
  ],
})
export class QueuesModule {}
