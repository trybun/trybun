import { type DynamicModule, Module } from '@nestjs/common';
import { AuthenticationModule } from './platform/authentication/authentication.module.js';
import { AuthorizationModule } from './platform/authorization/authorization.module.js';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { ClockModule } from './platform/clock/clock.module.js';
import { ConfigModule } from './platform/config/config.module.js';
import { DatabaseModule } from './platform/database/database.module.js';
import { ErrorsModule } from './platform/errors/errors.module.js';
import { I18nModule } from './platform/i18n/i18n.module.js';
import { HealthModule } from './platform/health/health.module.js';
import { HttpModule } from './platform/http/http.module.js';
import { LoggingModule } from './platform/logging/logging.module.js';

/** Root module of the API process (§14.6). */
@Module({})
export class ApiModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: ApiModule,
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        I18nModule,
        ErrorsModule,
        HttpModule,
        AuthenticationModule,
        AuthorizationModule,
        HealthModule,
      ],
    };
  }
}
