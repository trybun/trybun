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
import { KeycloakAdminModule } from './platform/keycloak-admin/keycloak-admin.module.js';
import { RateLimitingModule } from './platform/rate-limiting/rate-limiting.module.js';
import { administrationAbilities } from './modules/administration/administration.abilities.js';
import { AdministrationModule } from './modules/administration/administration.module.js';
import {
  archivedProjectsRestriction,
  projectsAbilities,
} from './modules/projects/projects.abilities.js';
import {
  archivedOrganizationsRestriction,
  organizationsAbilities,
} from './modules/organizations/organizations.abilities.js';
import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { SetupModule } from './modules/setup/setup.module.js';
import { UsersModule } from './modules/users/users.module.js';

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
        // After the authentication guard: the rate limit is keyed by the principal (§14.4).
        RateLimitingModule,
        AuthorizationModule.forRoot({
          rules: [administrationAbilities, projectsAbilities, organizationsAbilities],
          restrictions: [archivedProjectsRestriction, archivedOrganizationsRestriction],
        }),
        KeycloakAdminModule,
        HealthModule,
        UsersModule,
        SetupModule,
        AdministrationModule,
        ProjectsModule,
        OrganizationsModule,
      ],
    };
  }
}
