import 'server-only';
import type { PrismaClient } from '../database/prisma.js';
import type { KeycloakClient } from './keycloak-client.js';
import { isSessionExpired, nextIdleExpiry, type SessionExpiry } from './session-lifetimes.js';
import type { TokenCipher } from './token-cipher.js';

export interface SessionActivityDependencies {
  prisma: PrismaClient;
  cipher: TokenCipher;
  keycloak: KeycloakClient;
}

/**
 * Ends a web session (sign-out and expiry): deletes its row, then ends its Keycloak session, so the
 * next sign-in asks for the credentials again (§14.4).
 */
export async function endSession(
  { prisma, cipher, keycloak }: SessionActivityDependencies,
  tokenHash: string,
): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: { refreshToken: true },
  });
  if (session === null) {
    return;
  }
  await prisma.session.deleteMany({ where: { tokenHash } });
  await keycloak.endSession(await cipher.decrypt(session.refreshToken));
}

/**
 * A request of a session (a page or a call of the BFF): an expired session ends, an active one
 * moves its idle timeout forward (§14.4). Returns whether the session is still active.
 */
export async function recordSessionRequest(
  dependencies: SessionActivityDependencies,
  tokenHash: string,
  session: SessionExpiry,
  now: Date,
): Promise<boolean> {
  if (isSessionExpired(session, now)) {
    await endSession(dependencies, tokenHash);
    return false;
  }
  const idleExpiresAt = nextIdleExpiry(session, now);
  if (idleExpiresAt !== undefined) {
    await dependencies.prisma.session.updateMany({ where: { tokenHash }, data: { idleExpiresAt } });
  }
  return true;
}
