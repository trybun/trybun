import { Injectable } from '@nestjs/common';
import type { CurrentUser } from '@trybun/contracts/users';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { PrismaService } from '../../platform/database/prisma.service.js';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The account of the principal itself (§7.4). The authentication guard has already resolved it
   * as an active account, so it exists.
   */
  findCurrent(principal: UserPrincipal): Promise<CurrentUser> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: principal.userId },
      select: { id: true, displayName: true, email: true, kind: true },
    });
  }
}
