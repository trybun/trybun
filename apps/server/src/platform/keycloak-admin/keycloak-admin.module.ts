import { Global, Module } from '@nestjs/common';
import { KEYCLOAK_ADMIN } from './keycloak-admin.js';
import { KeycloakAdminClient } from './keycloak-admin-client.js';

/** The adapter of the Keycloak Admin API (§18.3). */
@Global()
@Module({
  providers: [{ provide: KEYCLOAK_ADMIN, useClass: KeycloakAdminClient }],
  exports: [KEYCLOAK_ADMIN],
})
export class KeycloakAdminModule {}
