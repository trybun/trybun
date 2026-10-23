import 'server-only';
import { getPrisma } from '../database/prisma.js';
import { getKeycloakClient } from './auth-options.js';

/**
 * Deletes the web sessions of the Keycloak session a valid logout token names (§14.4); `false`
 * for an invalid logout token.
 */
export async function endLoggedOutSessions(logoutToken: string): Promise<boolean> {
  const session = await getKeycloakClient().verifyLogoutToken(logoutToken);
  if (session === undefined) {
    return false;
  }
  await getPrisma().session.deleteMany({
    where: 'sid' in session ? { keycloakSessionId: session.sid } : { keycloakUserId: session.sub },
  });
  return true;
}
