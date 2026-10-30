import { Injectable } from '@nestjs/common';
import type { Transaction } from '../database/prisma.service.js';

/**
 * The web sessions (`sessions`, §14.4): written by the web application at sign-in; the API only
 * ends them, as an effect of a change of the account.
 */
@Injectable()
export class SessionsService {
  /**
   * Deletes every web session of a Keycloak user in the caller's transaction (deactivation,
   * §7.4), so its next request through the web application has no session. Returns their number.
   */
  async deleteAllOf(tx: Transaction, keycloakUserId: string): Promise<number> {
    const { count } = await tx.session.deleteMany({ where: { keycloakUserId } });
    return count;
  }
}
