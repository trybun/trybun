import { Inject, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../platform/database/prisma.service.js';
import {
  KEYCLOAK_ADMIN,
  type KeycloakAdmin,
} from '../../platform/keycloak-admin/keycloak-admin.js';

/**
 * Applies the state of an account to its Keycloak user (§7.4), the Worker's side of deactivation
 * and reactivation. It acts as the system and reads the current state, so it is idempotent and an
 * older event never undoes a newer change.
 */
@Injectable()
export class UsersKeycloakService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(KEYCLOAK_ADMIN) private readonly keycloak: KeycloakAdmin,
    @InjectPinoLogger(UsersKeycloakService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * A deactivated account: the Keycloak user disabled, so no new sign-in succeeds, and its
   * Keycloak sessions ended. An invited or active account: the Keycloak user enabled. An account
   * without a Keycloak user, or an anonymized one (S1-16), changes nothing. A failing call of the
   * Admin API fails the job, which BullMQ retries (§17.2).
   */
  async synchronize(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { keycloakUserId: true, state: true },
    });
    if (user?.keycloakUserId == null || user.state === 'anonymized') {
      return;
    }
    const isEnabled = user.state !== 'deactivated';
    await this.keycloak.setUserEnabled(user.keycloakUserId, isEnabled);
    if (!isEnabled) {
      await this.keycloak.logoutUser(user.keycloakUserId);
    }
    this.logger.info({ userId, isEnabled }, 'Keycloak user synchronized');
  }
}
