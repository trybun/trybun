import { Inject, Injectable } from '@nestjs/common';
import type { About, GettingStartedPage } from '@trybun/contracts/administration';
import packageJson from '../../../package.json' with { type: 'json' };
import type { Principal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { TRYBUN_CONFIG } from '../../platform/config/config.module.js';
import type { TrybunConfig } from '../../platform/config/config.schema.js';
import { AppError } from '../../platform/errors/app-error.js';
import { ADMINISTRATION } from './administration.abilities.js';
import { gettingStartedItems } from './domain/getting-started.js';

@Injectable()
export class AdministrationService {
  constructor(
    private readonly abilities: AbilityFactory,
    @Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig,
  ) {}

  /** The getting-started checklist (§15.6), a list bounded by its closed set of items (§18.4). */
  findGettingStarted(principal: Principal): GettingStartedPage {
    this.assertCanRead(principal);
    return { items: gettingStartedItems(this.config), nextCursor: null };
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
