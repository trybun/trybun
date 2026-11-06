import { Inject, Injectable } from '@nestjs/common';
import type { About, GettingStartedPage } from '@trybun/contracts/administration';
import packageJson from '../../../package.json' with { type: 'json' };
import type { Principal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { TRYBUN_CONFIG } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { ADMINISTRATION } from './administration.abilities.js';
import { gettingStartedItems } from './domain/getting-started.js';

@Injectable()
export class AdministrationService {
  constructor(
    private readonly abilities: AbilityFactory,
    private readonly prisma: PrismaService,
    @Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig,
  ) {}

  /** The getting-started checklist (§15.6), a list bounded by its closed set of items (§18.4). */
  async findGettingStarted(principal: Principal): Promise<GettingStartedPage> {
    this.assertCanRead(principal);
    const [projects, organizations, invitedTeam] = await Promise.all([
      this.prisma.project.count({ take: 1 }),
      this.prisma.organization.count({ take: 1 }),
      this.countInvitedTeam(),
    ]);
    return {
      items: gettingStartedItems({
        ...this.config,
        hasProject: projects > 0,
        hasOrganization: organizations > 0,
        hasInvitedTeam: invitedTeam > 0,
      }),
      nextCursor: null,
    };
  }

  /**
   * Team accounts other than the first Administrator – the oldest team account, created by the
   * first-run wizard (§15.6) – that are `invited` or `active`, at most one.
   */
  private async countInvitedTeam(): Promise<number> {
    const first = await this.prisma.user.findFirst({
      where: { kind: 'team' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { id: true },
    });
    if (first === null) {
      return 0;
    }
    return this.prisma.user.count({
      where: { kind: 'team', state: { in: ['invited', 'active'] }, id: { not: first.id } },
      take: 1,
    });
  }

  /** The "About" page (§15.4): the same version as `/health`. */
  findAbout(principal: Principal): About {
    this.assertCanRead(principal);
    return { version: packageJson.version, license: 'MIT' };
  }

  /** The Administrator panel does not exist for anyone else: `404`, never `403` (§17.2). */
  private assertCanRead(principal: Principal): void {
    if (!this.abilities.forPrincipal(principal).can('read', ADMINISTRATION)) {
      throw new AppError('request.not_found');
    }
  }
}
