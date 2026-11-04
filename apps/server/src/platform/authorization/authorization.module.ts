import { type DynamicModule, Global, Module } from '@nestjs/common';
import {
  ABILITY_RESTRICTIONS,
  ABILITY_RULES,
  AbilityFactory,
  type AbilityDefinitions,
} from './ability-factory.js';
import { PrismaRecordAccess } from './prisma-record-access.js';
import { RECORD_DESCRIPTORS, type RecordDescriptor } from './record-descriptor.js';
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
   * @param definitions the ability rules of the feature modules (`<feature>.abilities.ts`), the
   * global restrictions added after them and the record descriptors of the subjects with records
   */
  static forRoot({
    rules,
    restrictions,
    records,
  }: AbilityDefinitions & { records: readonly RecordDescriptor[] }): DynamicModule {
    return {
      module: AuthorizationModule,
      providers: [
        { provide: ABILITY_RULES, useValue: rules },
        { provide: ABILITY_RESTRICTIONS, useValue: restrictions },
        { provide: RECORD_DESCRIPTORS, useValue: records },
        AbilityFactory,
        { provide: RecordAccess, useClass: PrismaRecordAccess },
        TargetRecordGuard,
      ],
      exports: [AbilityFactory, RecordAccess, TargetRecordGuard],
    };
  }
}
