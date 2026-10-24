import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedRequest } from '../authentication/authentication.guard.js';
import { AppError } from '../errors/app-error.js';
import { RecordAccess } from './record-access.js';

/** The target record of a handler: its subject, the path parameter of its ID and the action. */
export interface TargetRecordOptions {
  subject: string;
  param: string;
  action: string;
}

export const TARGET_RECORD = 'TARGET_RECORD';

/** Primary keys are UUIDs (§17.2); any other value addresses no record. */
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

/**
 * Step 2 of the request pipeline (§18.3): looks up the record addressed by the path before the
 * body and the headers are validated, so the response for an invisible record is always `404`.
 */
@Injectable()
export class TargetRecordGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly records: RecordAccess,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = this.reflector.get<TargetRecordOptions | undefined>(
      TARGET_RECORD,
      context.getHandler(),
    );
    if (target === undefined) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const id = request.params[target.param];
    if (typeof id !== 'string' || !UUID.test(id)) {
      throw new AppError('request.not_found');
    }
    const decision = await this.records.decide(request.principal, {
      subject: target.subject,
      id,
      action: target.action,
    });
    if (decision.outcome === 'not_found') {
      throw new AppError('request.not_found');
    }
    if (decision.outcome === 'denied') {
      throw new AppError(decision.code);
    }
    return true;
  }
}
