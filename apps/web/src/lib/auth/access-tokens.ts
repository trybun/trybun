import 'server-only';
import type { PrismaClient } from '../database/prisma.js';
import type { KeycloakClient } from './keycloak-client.js';
import { hashSessionToken } from './session-adapter.js';
import type { TokenCipher } from './token-cipher.js';

/** An access token this close to its expiry is refreshed, so it never expires on its way to the API. */
const REFRESH_MARGIN_MS = 30_000;

/** Longest wait for a refresh in progress plus one's own call to Keycloak. */
const REFRESH_TRANSACTION_TIMEOUT_MS = 15_000;

/** The token columns of a session row locked for a refresh. */
interface LockedSession {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}

export interface AccessTokens {
  /**
   * The Keycloak access token of a session for the API (§14.4), refreshed when it is about to
   * expire; `undefined` for an unknown or expired session, or one whose Keycloak session ended.
   */
  forSession(sessionToken: string, now?: Date): Promise<string | undefined>;
}

export interface AccessTokensDependencies {
  prisma: PrismaClient;
  cipher: TokenCipher;
  keycloak: KeycloakClient;
}

export function createAccessTokens({
  prisma,
  cipher,
  keycloak,
}: AccessTokensDependencies): AccessTokens {
  const isFresh = (expiresAt: Date, now: Date) =>
    expiresAt.getTime() - REFRESH_MARGIN_MS > now.getTime();

  /**
   * Refreshes are serialized per session by a lock on its row: a concurrent request waits for the
   * refresh in progress and then uses its new token, so a rotated refresh token is never sent to
   * Keycloak twice (§14.4) – also across several instances of the web application.
   */
  function refresh(tokenHash: string, now: Date): Promise<string | undefined> {
    return prisma.$transaction(
      async (tx) => {
        const [session] = await tx.$queryRaw<LockedSession[]>`
          SELECT access_token AS "accessToken",
                 access_token_expires_at AS "accessTokenExpiresAt",
                 refresh_token AS "refreshToken"
          FROM sessions
          WHERE token_hash = ${tokenHash}
          FOR UPDATE`;
        if (session === undefined) {
          return undefined;
        }
        if (isFresh(session.accessTokenExpiresAt, now)) {
          return cipher.decrypt(session.accessToken);
        }
        const tokens = await keycloak.refreshTokens(await cipher.decrypt(session.refreshToken), now);
        if (tokens === undefined) {
          // The Keycloak session has ended: the web session ends with it.
          await tx.session.deleteMany({ where: { tokenHash } });
          return undefined;
        }
        await tx.session.updateMany({
          where: { tokenHash },
          data: {
            accessToken: await cipher.encrypt(tokens.accessToken),
            accessTokenExpiresAt: tokens.accessTokenExpiresAt,
            refreshToken: await cipher.encrypt(tokens.refreshToken),
          },
        });
        return tokens.accessToken;
      },
      { timeout: REFRESH_TRANSACTION_TIMEOUT_MS },
    );
  }

  return {
    async forSession(sessionToken, now = new Date()) {
      const tokenHash = hashSessionToken(sessionToken);
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        select: { accessToken: true, accessTokenExpiresAt: true, expiresAt: true },
      });
      if (session === null || session.expiresAt <= now) {
        return undefined;
      }
      if (isFresh(session.accessTokenExpiresAt, now)) {
        return cipher.decrypt(session.accessToken);
      }
      return refresh(tokenHash, now);
    },
  };
}
