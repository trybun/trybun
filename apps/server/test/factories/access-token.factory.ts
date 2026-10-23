// Keycloak access tokens of tests (§18.7): signed with a test key whose JWKS the MSW handler
// serves at the Keycloak address of the configuration.
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { http, HttpResponse } from 'msw';
import type { TrybunConfig } from '../../src/platform/config/config.schema.js';

const KEY_ID = 'test-key';
const signingKey = await generateKeyPair('RS256');
const foreignKey = await generateKeyPair('RS256');

/** Serves the public test key as the Keycloak JWKS. */
export function keycloakJwksHandler(config: TrybunConfig) {
  return http.get(config.keycloak.jwksUrl, async () =>
    HttpResponse.json({
      keys: [{ ...(await exportJWK(signingKey.publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' }],
    }),
  );
}

export interface AccessTokenOptions {
  /** A key that is not in the JWKS. */
  foreignKey?: boolean;
  /** Seconds from now; negative for an expired token. */
  expiresIn?: number;
}

/** An access token as Keycloak issues it for the web application (`aud` = `trybun-api`). */
export function signAccessToken(
  config: TrybunConfig,
  claims: JWTPayload & { amr?: string[] } = {},
  options: AccessTokenOptions = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    iss: config.keycloak.issuer,
    aud: 'trybun-api',
    sub: randomUUID(),
    azp: 'trybun-web',
    amr: ['pwd'],
    iat: now,
    exp: now + (options.expiresIn ?? 300),
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID, typ: 'JWT' })
    .sign(options.foreignKey === true ? foreignKey.privateKey : signingKey.privateKey);
}
