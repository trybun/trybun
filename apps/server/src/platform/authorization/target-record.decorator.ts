import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import {
  TARGET_RECORD,
  TargetRecordGuard,
  type TargetRecordOptions,
} from './target-record.guard.js';

/**
 * Declares the record a handler acts on (§18.3, step 2), e.g.
 * `@TargetRecord({ subject: 'Ticket', param: 'ticketId', action: 'update' })`: a missing or
 * invisible record returns `404`, a visible one on which the action is not permitted `403`.
 */
export function TargetRecord(target: TargetRecordOptions) {
  return applyDecorators(SetMetadata(TARGET_RECORD, target), UseGuards(TargetRecordGuard));
}
