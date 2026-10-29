import { type DynamicModule, Global, Module } from '@nestjs/common';
import {
  ABILITY_RESTRICTIONS,
  ABILITY_RULES,
  AbilityFactory,
  type AbilityDefinitions,
} from './ability-factory.js';
import { PrismaRecordAccess } from './prisma-record-access.js';
import { RecordAccess } from './record-access.js';
import { TargetRecordGuard } from './target-record.guard.js';

/**
 * Authorization of the API (§18.3). Global, because the target record guard runs in the context
 * of every feature module that declares `@TargetRecord()`, and every service checks the ability.
 */
@Global()
@Module({})
export class AuthorizationModule {
  /**
   * @param definitions the ability rules of the feature modules (`<feature>.abilities.ts`) and the
   * global restrictions added after them
   */
  static forRoot({ rules, restrictions }: AbilityDefinitions): DynamicModule {
    return {
      module: AuthorizationModule,
      providers: [
        { provide: ABILITY_RULES, useValue: rules },
        { provide: ABILITY_RESTRICTIONS, useValue: restrictions },
        AbilityFactory,
        { provide: RecordAccess, useClass: PrismaRecordAccess },
        TargetRecordGuard,
      ],
      exports: [AbilityFactory, RecordAccess, TargetRecordGuard],
    };
  }
}
