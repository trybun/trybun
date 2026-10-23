import { Inject, Injectable } from '@nestjs/common';
import { createRemoteJWKSet, errors, type JWTVerifyGetKey, jwtVerify } from 'jose';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import type { AccessTokenClaims, AccessTokenVerifier } from './access-token-verifier.js';

/** The audience of the access tokens issued for the API (docker/keycloak/realm/trybun.yaml). */
export const API_AUDIENCE = 'trybun-api';

/** Errors of a token that is not valid; any other error (e.g. Keycloak unreachable) propagates. */
const INVALID_TOKEN_ERRORS = new Set([
  errors.JOSEAlgNotAllowed.code,
  errors.JOSENotSupported.code,
  errors.JWKSMultipleMatchingKeys.code,
  errors.JWKSNoMatchingKey.code,
  errors.JWSInvalid.code,
  errors.JWSSignatureVerificationFailed.code,
  errors.JWTClaimValidationFailed.code,
  errors.JWTExpired.code,
  errors.JWTInvalid.code,
]);

/**
 * Verifies Keycloak access tokens against the realm's signing keys, fetched over the internal
 * network and cached (§14.4): algorithm `RS256` only, the public issuer, the audience
 * `trybun-api` and a valid `exp`.
 */
@Injectable()
export class KeycloakAccessTokenVerifier implements AccessTokenVerifier {
  private readonly keys: JWTVerifyGetKey;
  private readonly issuer: string;

  constructor(@Inject(TRYBUN_CONFIG) config: TrybunConfig) {
    this.keys = createRemoteJWKSet(new URL(config.keycloak.jwksUrl));
    this.issuer = config.keycloak.issuer;
  }

  async verify(token: string): Promise<AccessTokenClaims | undefined> {
    try {
      const { payload } = await jwtVerify(token, this.keys, {
        algorithms: ['RS256'],
        issuer: this.issuer,
        audience: API_AUDIENCE,
        requiredClaims: ['sub', 'exp'],
      });
      const amr = Array.isArray(payload.amr)
        ? payload.amr.filter((method): method is string => typeof method === 'string')
        : [];
      return { sub: payload.sub as string, amr };
    } catch (error) {
      if (error instanceof errors.JOSEError && INVALID_TOKEN_ERRORS.has(error.code)) {
        return undefined;
      }
      throw error;
    }
  }
}
