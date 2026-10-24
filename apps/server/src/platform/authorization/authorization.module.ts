import { Global, Module } from '@nestjs/common';
import { NoSubjectRecordAccess, RecordAccess } from './record-access.js';
import { TargetRecordGuard } from './target-record.guard.js';

/**
 * Authorization of the API (§18.3). Global, because the target record guard runs in the context
 * of every feature module that declares `@TargetRecord()`.
 */
@Global()
@Module({
  providers: [{ provide: RecordAccess, useClass: NoSubjectRecordAccess }, TargetRecordGuard],
  exports: [RecordAccess, TargetRecordGuard],
})
export class AuthorizationModule {}
