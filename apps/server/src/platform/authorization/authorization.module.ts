import { type DynamicModule, Global, Module } from '@nestjs/common';
import { ABILITY_RULES, AbilityFactory, type AbilityRules } from './ability-factory.js';
import { NoSubjectRecordAccess, RecordAccess } from './record-access.js';
import { TargetRecordGuard } from './target-record.guard.js';

/**
 * Authorization of the API (§18.3). Global, because the target record guard runs in the context
 * of every feature module that declares `@TargetRecord()`, and every service checks the ability.
 */
@Global()
@Module({})
export class AuthorizationModule {
  /** @param rules the ability rules of the feature modules (`<feature>.abilities.ts`) */
  static forRoot(rules: readonly AbilityRules[]): DynamicModule {
    return {
      module: AuthorizationModule,
      providers: [
        { provide: ABILITY_RULES, useValue: rules },
        AbilityFactory,
        { provide: RecordAccess, useClass: NoSubjectRecordAccess },
        TargetRecordGuard,
      ],
      exports: [AbilityFactory, RecordAccess, TargetRecordGuard],
    };
  }
}
