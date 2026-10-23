// Keycloak tokens of tests (§18.7): logout tokens signed with a test key whose JWKS the MSW
// handler serves at the internal Keycloak address of the environment.
import { randomUUID } from 'node:crypto';
import { exportJWK, generateKeyPair, type JWTPayload, SignJWT } from 'jose';
import { http, HttpResponse } from 'msw';
import { TEST_ENV } from '../env.js';

const KEY_ID = 'test-key';
const signingKey = await generateKeyPair('RS256');
const foreignKey = await generateKeyPair('RS256');

export const KEYCLOAK_ENDPOINTS = `${TEST_ENV.TRYBUN_KEYCLOAK_URL}/realms/trybun/protocol/openid-connect`;
export const KEYCLOAK_ISSUER = `https://${TEST_ENV.TRYBUN_DOMAIN}/auth/realms/trybun`;

/** Serves the public test key as the Keycloak JWKS. */
export const keycloakJwksHandler = http.get(`${KEYCLOAK_ENDPOINTS}/certs`, async () =>
  HttpResponse.json({
    keys: [{ ...(await exportJWK(signingKey.publicKey)), kid: KEY_ID, alg: 'RS256', use: 'sig' }],
  }),
);

/** A logout token of back-channel logout as Keycloak sends it to `trybun-web`. */
export function signLogoutToken(
  claims: JWTPayload = {},
  options: { foreignKey?: boolean } = {},
): Promise<string> {
  const now = Math.floor(Date.now() / 1_000);
  return new SignJWT({
    iss: KEYCLOAK_ISSUER,
    aud: 'trybun-web',
    sub: randomUUID(),
    sid: randomUUID(),
    iat: now,
    exp: now + 120,
    jti: randomUUID(),
    typ: 'Logout',
    events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
    ...claims,
  })
    .setProtectedHeader({ alg: 'RS256', kid: KEY_ID, typ: 'JWT' })
    .sign(options.foreignKey === true ? foreignKey.privateKey : signingKey.privateKey);
}
