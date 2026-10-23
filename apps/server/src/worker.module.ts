import { type DynamicModule, Module } from '@nestjs/common';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { ConfigModule } from './platform/config/config.module.js';
import { HeartbeatModule } from './platform/health/heartbeat.module.js';

/** Root module of the Worker process (§14.6); feature worker modules are imported here. */
@Module({})
export class WorkerModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: WorkerModule,
      imports: [ConfigModule.forRoot(config), HeartbeatModule],
    };
  }
}
