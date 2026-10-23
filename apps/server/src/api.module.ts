import { type DynamicModule, Module } from '@nestjs/common';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { ClockModule } from './platform/clock/clock.module.js';
import { ConfigModule } from './platform/config/config.module.js';
import { DatabaseModule } from './platform/database/database.module.js';
import { HealthModule } from './platform/health/health.module.js';
import { HttpModule } from './platform/http/http.module.js';

/** Root module of the API process (§14.6). */
@Module({})
export class ApiModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: ApiModule,
      imports: [
        ConfigModule.forRoot(config),
        ClockModule,
        DatabaseModule,
        HttpModule,
        HealthModule,
      ],
    };
  }
}
