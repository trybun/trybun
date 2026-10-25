import { type DynamicModule, Module } from '@nestjs/common';
import type { TrybunConfig } from './platform/config/config.schema.js';
import { ClockModule } from './platform/clock/clock.module.js';
import { ConfigModule } from './platform/config/config.module.js';
import { DatabaseModule } from './platform/database/database.module.js';
import { KeycloakAdminModule } from './platform/keycloak-admin/keycloak-admin.module.js';
import { SetupModule } from './modules/setup/setup.module.js';

/** Root module of the command line of the `server` image (§14.6): only what its commands use. */
@Module({})
export class CliModule {
  static forRoot(config: TrybunConfig): DynamicModule {
    return {
      module: CliModule,
      imports: [
        ConfigModule.forRoot(config),
        ClockModule,
        DatabaseModule,
        KeycloakAdminModule,
        SetupModule,
      ],
    };
  }
}
