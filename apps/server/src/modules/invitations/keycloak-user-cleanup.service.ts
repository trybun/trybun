import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Clock } from '../../platform/clock/clock.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  KEYCLOAK_ADMIN,
  type KeycloakAdmin,
} from '../../platform/keycloak-admin/keycloak-admin.js';

/**
 * How long a Keycloak user may exist without an account (AQ2): long enough for an acceptance
 * started from an invitation to complete.
 */
export const KEYCLOAK_USER_WITHOUT_ACCOUNT_TTL_MS = 24 * 60 * 60 * 1_000;

/**
 * Deletes Keycloak users that no account links to (AQ2 of the invitation acceptance): users created
 * by a sign-in through an identity provider from a crafted request or an abandoned acceptance, and
 * users of a password acceptance whose transaction failed after Keycloak was reached. They give no
 * access, but Keycloak holds their name and address (§13.2).
 */
@Injectable()
export class KeycloakUserCleanupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdmin,
    @InjectPinoLogger(KeycloakUserCleanupService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Deletes the Keycloak users created more than 24 hours ago that no account – in any state –
   * links to, and returns their number. A repeated run finds none, so the run is idempotent.
   */
  async deleteUsersWithoutAccount(): Promise<number> {
    const createdBefore = this.clock.now().getTime() - KEYCLOAK_USER_WITHOUT_ACCOUNT_TTL_MS;
    const candidates = (await this.keycloak.listUsers()).filter(
      ({ createdAt }) => createdAt.getTime() < createdBefore,
    );
    const linked = new Set(
      (
        await this.prisma.user.findMany({
          where: { keycloakUserId: { in: candidates.map(({ id }) => id) } },
          select: { keycloakUserId: true },
        })
      ).map(({ keycloakUserId }) => keycloakUserId),
    );
    const orphans = candidates.filter(({ id }) => !linked.has(id));
    for (const { id } of orphans) {
      await this.keycloak.deleteUser(id);
    }
    this.logger.info({ count: orphans.length }, 'Keycloak users without an account deleted');
    return orphans.length;
  }
}
