import 'server-only';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

/** The event of a logout token (OpenID Connect Back-Channel Logout 1.0). */
const BACKCHANNEL_LOGOUT_EVENT = 'http://schemas.openid.net/event/backchannel-logout';

export interface KeycloakSettings {
  /** The public issuer of the tokens. */
  issuer: string;
  /** The realm on the internal network. */
  internalRealmUrl: string;
  clientId: string;
  clientSecret: string;
}

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

/** The Keycloak session a logout token ends: `sid`, or all sessions of `sub`. */
export type LoggedOutSession = { sid: string } | { sub: string };

/** The tokens of a refresh: Keycloak rotates the refresh token on every use (§14.4). */
export interface RefreshedTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

const refreshResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string(),
});

/** The calls of the web application to Keycloak besides the sign-in of Auth.js (§14.4). */
export interface KeycloakClient {
  /** Ends the Keycloak session of a refresh token (sign-out). */
  endSession(refreshToken: string): Promise<void>;
  /** New tokens for a refresh token; `undefined` when its Keycloak session has ended. */
  refreshTokens(refreshToken: string, now: Date): Promise<RefreshedTokens | undefined>;
  /** The session of a valid logout token of back-channel logout; `undefined` otherwise. */
  verifyLogoutToken(logoutToken: string): Promise<LoggedOutSession | undefined>;
}

export function createKeycloakClient(settings: KeycloakSettings): KeycloakClient {
  const endpoints = `${settings.internalRealmUrl}/protocol/openid-connect`;
  const keys: JWTVerifyGetKey = createRemoteJWKSet(new URL(`${endpoints}/certs`));
  return {
    async endSession(refreshToken) {
      const response = await fetch(`${endpoints}/logout`, {
        method: 'POST',
        body: new URLSearchParams({
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          refresh_token: refreshToken,
        }),
      });
      // 400: the refresh token is no longer valid, so its session has already ended.
      if (!response.ok && response.status !== 400) {
        throw new Error(`Keycloak logout failed with status ${response.status}`);
      }
    },
    async refreshTokens(refreshToken, now) {
      const response = await fetch(`${endpoints}/token`, {
        method: 'POST',
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: settings.clientId,
          client_secret: settings.clientSecret,
          refresh_token: refreshToken,
        }),
      });
      // 400 `invalid_grant`: the session has ended or the refresh token was already used.
      if (response.status === 400) {
        return undefined;
      }
      if (!response.ok) {
        throw new Error(`Keycloak token refresh failed with status ${response.status}`);
      }
      const tokens = refreshResponseSchema.parse(await response.json());
      return {
        accessToken: tokens.access_token,
        accessTokenExpiresAt: new Date(now.getTime() + tokens.expires_in * 1_000),
        refreshToken: tokens.refresh_token,
      };
    },
    async verifyLogoutToken(logoutToken) {
      try {
        const { payload } = await jwtVerify(logoutToken, keys, {
          algorithms: ['RS256'],
          issuer: settings.issuer,
          audience: settings.clientId,
          requiredClaims: ['iat', 'jti', 'events'],
        });
        const events = payload.events as Record<string, unknown> | undefined;
        if (typeof events?.[BACKCHANNEL_LOGOUT_EVENT] !== 'object' || 'nonce' in payload) {
          return undefined;
        }
        if (typeof payload.sid === 'string') {
          return { sid: payload.sid };
        }
        return typeof payload.sub === 'string' ? { sub: payload.sub } : undefined;
      } catch (error) {
        if (error instanceof errors.JOSEError && INVALID_TOKEN_ERRORS.has(error.code)) {
          return undefined;
        }
        throw error;
      }
    },
  };
}
