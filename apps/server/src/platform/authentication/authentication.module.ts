import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ACCESS_TOKEN_VERIFIER } from './access-token-verifier.js';
import { AuthenticationGuard } from './authentication.guard.js';
import { AuthenticationService } from './authentication.service.js';
import { KeycloakAccessTokenVerifier } from './keycloak-access-token-verifier.js';

/**
 * Authentication of the API (§14.4): a global guard requires a principal on every endpoint that is
 * not marked `@Public()`. The token verifier is exported for the one public endpoint that accepts
 * the token of a Keycloak user without an account: the acceptance of an invitation (ADR 0009).
 */
@Module({
  providers: [
    AuthenticationService,
    { provide: ACCESS_TOKEN_VERIFIER, useClass: KeycloakAccessTokenVerifier },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
  ],
  exports: [ACCESS_TOKEN_VERIFIER],
})
export class AuthenticationModule {}
