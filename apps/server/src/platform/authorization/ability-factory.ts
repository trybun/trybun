import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import { Inject, Injectable } from '@nestjs/common';
import type { Principal } from '../authentication/principal.js';

/**
 * The CASL ability of a principal (§18.3): actions are the snake_case codes of `@trybun/contracts`,
 * subjects the Prisma model names or – for a part of the system without records – its name (e.g.
 * `Administration`).
 */
export type AppAbility = MongoAbility<[string, string]>;

/** The rules a feature module defines in its `<feature>.abilities.ts` (§18.3). */
export type AbilityRules = (builder: AbilityBuilder<AppAbility>, principal: Principal) => void;

export const ABILITY_RULES = Symbol('AbilityRules');

/**
 * Builds the ability of a principal from the rules of all feature modules, passed to
 * `AuthorizationModule.forRoot()` by the root module. Global restrictions (token scope, archived
 * projects) join with the permission layer (S1-04) as the last `cannot` rules.
 */
@Injectable()
export class AbilityFactory {
  constructor(@Inject(ABILITY_RULES) private readonly rules: readonly AbilityRules[]) {}

  forPrincipal(principal: Principal): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createMongoAbility);
    for (const define of this.rules) {
      define(builder, principal);
    }
    return builder.build();
  }
}
