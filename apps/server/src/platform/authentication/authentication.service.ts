import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { UserPrincipal } from './principal.js';

@Injectable()
export class AuthenticationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The principal of the account linked to the Keycloak user `sub` (§7.4). Accounts that are not
   * active – invited, deactivated or anonymized – have none, even with a valid token (§14.4).
   */
  async findPrincipal(keycloakUserId: string): Promise<UserPrincipal | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { keycloakUserId },
      select: { id: true, kind: true, isAdmin: true, state: true },
    });
    if (user?.state !== 'active') {
      return undefined;
    }
    return { kind: 'user', userId: user.id, userKind: user.kind, isAdmin: user.isAdmin };
  }
}
