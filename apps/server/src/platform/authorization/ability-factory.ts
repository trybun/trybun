import { type Ability, AbilityBuilder } from '@casl/ability';
import { createPrismaAbility, type PrismaQueryOf, type Subjects } from '@casl/prisma/runtime';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../authentication/principal.js';

/**
 * The subjects of the abilities (§18.3): the Prisma model names – with their records, whose rule
 * conditions are Prisma `WhereInput`s – and the parts of the system without records (e.g.
 * `Administration`). A record carries only the fields its rules read. Feature tasks add their
 * models.
 */
export type AppSubject = Subjects<{ Project: ProjectRuleRecord }> | 'Administration';

/**
 * A project as its rules read it: its state and the memberships of the principal, loaded with
 * `members: { where: { userId: principal.userId } }`.
 */
export type ProjectRuleRecord = {
  id: string;
  state: string;
  members: { userId: string; role: string }[];
};

/** The conditions of a rule: the Prisma `WhereInput` of its subject. */
export type PrismaQuery = PrismaQueryOf<Prisma.TypeMap>;

/**
 * The CASL ability of a principal (§18.3): actions are the snake_case codes of `@trybun/contracts`.
 * The same rules check actions on records and build the filters of queries (`accessibleBy`).
 */
export type AppAbility = Ability<[string, AppSubject], PrismaQuery>;

/** The rules a feature module defines in its `<feature>.abilities.ts` (§18.3). */
export type AbilityRules = (builder: AbilityBuilder<AppAbility>, principal: Principal) => void;

export const ABILITY_RULES = Symbol('AbilityRules');
export const ABILITY_RESTRICTIONS = Symbol('AbilityRestrictions');

/** The rules of the feature modules and the global restrictions added after them (§18.3). */
export interface AbilityDefinitions {
  rules: readonly AbilityRules[];
  /** `cannot` rules that override every other rule, e.g. the archived state of projects. */
  restrictions: readonly AbilityRules[];
}

/**
 * Builds the ability of a principal from the rules of all feature modules, passed to
 * `AuthorizationModule.forRoot()` by the root module, followed by the global restrictions (§18.3),
 * so they override every other rule.
 */
@Injectable()
export class AbilityFactory {
  constructor(
    @Inject(ABILITY_RULES) private readonly rules: readonly AbilityRules[],
    @Inject(ABILITY_RESTRICTIONS) private readonly restrictions: readonly AbilityRules[] = [],
  ) {}

  forPrincipal(principal: Principal): AppAbility {
    const builder = new AbilityBuilder<AppAbility>(createPrismaAbility);
    for (const define of [...this.rules, ...this.restrictions]) {
      define(builder, principal);
    }
    return builder.build();
  }
}
