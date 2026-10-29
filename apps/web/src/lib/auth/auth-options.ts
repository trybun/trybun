import 'server-only';
import { decodeJwt } from 'jose';
import type { Account, NextAuthOptions } from 'next-auth';
import { getPrisma } from '../database/prisma.js';
import { storeLanguage } from '../i18n/language-cookie.js';
import { storeTimeZone } from '../i18n/time-zone-cookie.js';
import { getEnv, type WebEnv } from '../env/env.js';
import { type AccessTokens, createAccessTokens } from './access-tokens.js';
import { KeycloakProvider } from './next-auth.js';
import { createKeycloakClient, type KeycloakClient } from './keycloak-client.js';
import { createSessionAdapter, type KeycloakTokens, type SignInTokens } from './session-adapter.js';
import { signedInAccountOf } from './signed-in-account.js';
import { SESSION_LIFETIMES } from './session-lifetimes.js';
import { createTokenCipher, type TokenCipher } from './token-cipher.js';

/**
 * Lifetime of the session cookie: the longest session (end users, §14.4). The session row holds
 * the lifetimes of the account kind; Keycloak ends sessions earlier through back-channel logout
 * and when a refresh fails.
 */
const SESSION_MAX_AGE_SECONDS = SESSION_LIFETIMES.end_user.maxLifetimeSeconds;

/** The page that starts the sign-in with Keycloak. */
export const SIGN_IN_PATH = '/sign-in';

/** The cookie of Auth.js 4 that holds the opaque session token; `__Secure-` on HTTPS. */
export function sessionCookieName(): string {
  return `${getEnv().shouldUseSecureCookies ? '__Secure-' : ''}next-auth.session-token`;
}

/** The Keycloak tokens of a sign-in; `undefined` for an incomplete token response. */
export function toKeycloakTokens(account: Account): KeycloakTokens | undefined {
  const { access_token: accessToken, refresh_token: refreshToken, expires_at: expiresAt } = account;
  const sid = account.id_token === undefined ? undefined : decodeJwt(account.id_token).sid;
  if (
    accessToken === undefined ||
    refreshToken === undefined ||
    expiresAt === undefined ||
    typeof sid !== 'string'
  ) {
    return undefined;
  }
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresAt: new Date(expiresAt * 1_000),
    keycloakSessionId: sid,
  };
}

let dependencies:
  | { env: WebEnv; cipher: TokenCipher; keycloak: KeycloakClient; accessTokens: AccessTokens }
  | undefined;

function getDependencies() {
  if (dependencies === undefined) {
    const env = getEnv();
    const cipher = createTokenCipher(env.authSecret);
    const keycloak = createKeycloakClient(env.keycloak);
    dependencies = {
      env,
      cipher,
      keycloak,
      accessTokens: createAccessTokens({ prisma: getPrisma(), cipher, keycloak }),
    };
  }
  return dependencies;
}

/** The access tokens of the sessions for the API (BFF proxy, server API client, §14.4). */
export function getAccessTokens(): AccessTokens {
  return getDependencies().accessTokens;
}

/** The Keycloak client of the web application (back-channel logout, sign-out). */
export function getKeycloakClient(): KeycloakClient {
  return getDependencies().keycloak;
}

/**
 * Auth.js with Keycloak and server-side sessions (§14.4, ADR 0004). The Route Handler creates the
 * options per request with its own `signIn` slot, so the tokens of one sign-in reach only the
 * session that this sign-in creates.
 */
export function createAuthOptions(signIn?: SignInTokens): NextAuthOptions {
  const { env, cipher, keycloak } = getDependencies();
  return {
    secret: env.authSecret,
    providers: [
      KeycloakProvider({
        clientId: env.keycloak.clientId,
        clientSecret: env.keycloak.clientSecret,
        issuer: env.keycloak.issuer,
        // Discovery over the internal network; Keycloak returns the public issuer and the
        // public authorization endpoint (§15.5).
        wellKnown: `${env.keycloak.internalRealmUrl}/.well-known/openid-configuration`,
        // The account data comes from the API, so only the identity is requested.
        authorization: { params: { scope: 'openid' } },
        profile: (profile: { sub: string }) => ({ id: profile.sub }),
      }),
    ],
    adapter: createSessionAdapter({ prisma: getPrisma(), cipher, keycloak, signIn }),
    session: { strategy: 'database', maxAge: SESSION_MAX_AGE_SECONDS },
    pages: { signIn: SIGN_IN_PATH },
    callbacks: {
      async signIn({ account }) {
        const tokens = account === null ? undefined : toKeycloakTokens(account);
        if (signIn === undefined || tokens === undefined) {
          return false;
        }
        signIn.current = tokens;
        const signedIn = await signedInAccountOf(env.apiUrl, tokens.accessToken);
        signIn.accountKind = signedIn?.kind;
        // The language and the time zone of the account follow the person to every device (§13.1).
        if (signedIn?.language != null) {
          await storeLanguage(signedIn.language);
        }
        if (signedIn !== undefined) {
          await storeTimeZone(signedIn.timeZone);
        }
        return true;
      },
      // The browser-visible session (`/api/auth/session`) carries neither tokens nor user data.
      session: ({ session }) => ({ expires: session.expires }),
    },
  };
}
