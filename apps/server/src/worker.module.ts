import { type DynamicModule, Module } from '@nestjs/common';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { ClockModule } from './platform/clock/clock.module.js';
import { ConfigModule } from './platform/config/config.module.js';
import { DatabaseModule } from './platform/database/database.module.js';
import { HeartbeatModule } from './platform/health/heartbeat.module.js';
import { OutboxWorkerModule } from './platform/outbox/outbox-worker.module.js';
import { QueuesModule } from './platform/queues/queues.module.js';

/**
 * Root module of the Worker process (§14.6); feature worker modules are imported here, and their
 * outbox subscriptions are passed to the outbox publisher.
 */
@Module({})
export class WorkerModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [
        ConfigModule.forRoot(config),
        ClockModule,
        DatabaseModule,
        QueuesModule,
        OutboxWorkerModule.forRoot([]),
        HeartbeatModule,
      ],
    };
  }
}
