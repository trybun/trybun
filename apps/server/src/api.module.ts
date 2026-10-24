import { type DynamicModule, Module } from '@nestjs/common';
import { AuthenticationModule } from './platform/authentication/authentication.module.js';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { ClockModule } from './platform/clock/clock.module.js';
import { ConfigModule } from './platform/config/config.module.js';
import { DatabaseModule } from './platform/database/database.module.js';
import { I18nModule } from './platform/i18n/i18n.module.js';
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
        I18nModule,
        HttpModule,
        AuthenticationModule,
        HealthModule,
      ],
    };
  }
}
