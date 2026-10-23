import 'server-only';
import { createHash } from 'node:crypto';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import type { PrismaClient } from '../database/prisma.js';
import type { KeycloakClient } from './keycloak-client.js';
import type { TokenCipher } from './token-cipher.js';

/** The Keycloak tokens of a sign-in, stored encrypted in its session row (§14.4). */
export interface KeycloakTokens {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
  /** The Keycloak session (`sid`). */
  keycloakSessionId: string;
}

/**
 * The tokens of the sign-in handled by one request to Auth.js: the `signIn` callback receives
 * them before the adapter creates the session (`createAuthOptions`).
 */
export interface SignInTokens {
  current?: KeycloakTokens;
}

/** Only a hash of the session token in the cookie is stored, like other bearer secrets (§13.5). */
export function hashSessionToken(sessionToken: string): string {
  return createHash('sha256').update(sessionToken).digest('base64url');
}

/**
 * The user of Auth.js is the Keycloak user (`sub`): the web application keeps no account data and
 * the API resolves the account from the access token (§7.4, §14.4).
 */
function keycloakUser(sub: string): AdapterUser {
  return { id: sub, email: '', emailVerified: null };
}

export interface SessionAdapterDependencies {
  prisma: PrismaClient;
  cipher: TokenCipher;
  keycloak: KeycloakClient;
  /** The tokens of the request's sign-in; absent where no session is created. */
  signIn?: SignInTokens;
}

/**
 * The Auth.js adapter of the `database` session strategy (ADR 0004): server-side sessions in the
 * table `sessions`, without the user, account and verification-token models of Auth.js.
 */
export function createSessionAdapter({
  prisma,
  cipher,
  keycloak,
  signIn,
}: SessionAdapterDependencies): Adapter {
  return {
    getUserByAccount: ({ providerAccountId }) => keycloakUser(providerAccountId),

    async createSession({ sessionToken, userId, expires }) {
      const tokens = signIn?.current;
      if (tokens === undefined) {
        throw new Error('A session is created only by a sign-in with Keycloak');
      }
      await prisma.session.create({
        data: {
          tokenHash: hashSessionToken(sessionToken),
          keycloakUserId: userId,
          keycloakSessionId: tokens.keycloakSessionId,
          accessToken: await cipher.encrypt(tokens.accessToken),
          accessTokenExpiresAt: tokens.accessTokenExpiresAt,
          refreshToken: await cipher.encrypt(tokens.refreshToken),
          expiresAt: expires,
        },
      });
      return { sessionToken, userId, expires };
    },

    async getSessionAndUser(sessionToken) {
      const session = await prisma.session.findUnique({
        where: { tokenHash: hashSessionToken(sessionToken) },
        select: { keycloakUserId: true, expiresAt: true },
      });
      if (session === null) {
        return null;
      }
      return {
        session: { sessionToken, userId: session.keycloakUserId, expires: session.expiresAt },
        user: keycloakUser(session.keycloakUserId),
      };
    },

    async updateSession({ sessionToken, expires }) {
      if (expires !== undefined) {
        await prisma.session.updateMany({
          where: { tokenHash: hashSessionToken(sessionToken) },
          data: { expiresAt: expires },
        });
      }
      return undefined;
    },

    // Sign-out and expiry: the row is deleted, then the Keycloak session is ended too.
    async deleteSession(sessionToken) {
      const tokenHash = hashSessionToken(sessionToken);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        select: { refreshToken: true },
      });
      if (session === null) {
        return;
      }
      await prisma.session.deleteMany({ where: { tokenHash } });
      await keycloak.endSession(await cipher.decrypt(session.refreshToken));
    },
  };
}
