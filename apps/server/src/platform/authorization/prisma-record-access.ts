import { accessibleBy } from '@casl/prisma/runtime';
import { Inject, Injectable } from '@nestjs/common';
import { type ErrorCode, errorCodeSchema } from '@trybun/contracts/errors';
import type { Principal } from '../authentication/principal.js';
import { PrismaService } from '../database/prisma.service.js';
import { AbilityFactory, type AppAbility } from './ability-factory.js';
import {
  RECORD_DESCRIPTORS,
  type RecordDescriptor,
  type RecordFilters,
  type RecordSubject,
} from './record-descriptor.js';
import { RecordAccess, type RecordAccessDecision, type TargetRecord } from './record-access.js';

/**
 * The record access of the request pipeline (§18.3): the record is loaded only through the
 * `read` filter of the ability, by the record descriptor of its subject, so an invisible record is
 * never loaded; the action is then checked on it, and a denying rule with a reason (e.g.
 * `project.archived`) answers with its code.
 */
@Injectable()
export class PrismaRecordAccess extends RecordAccess {
  private readonly descriptors: ReadonlyMap<string, RecordDescriptor>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
    @Inject(RECORD_DESCRIPTORS) descriptors: readonly RecordDescriptor[],
  ) {
    super();
    const bySubject = new Map<string, RecordDescriptor>();
    for (const descriptor of descriptors) {
      if (bySubject.has(descriptor.subject)) {
        throw new Error(`Two record descriptors for the subject ${descriptor.subject}`);
      }
      bySubject.set(descriptor.subject, descriptor);
    }
    this.descriptors = bySubject;
  }

  async decide(principal: Principal, target: TargetRecord): Promise<RecordAccessDecision> {
    const descriptor = this.descriptors.get(target.subject);
    if (descriptor === undefined) {
      // A programming error, never a silent `404`: `@TargetRecord()` names a subject without one.
      throw new Error(`No record descriptor for the subject ${target.subject}`);
    }
    const ability = this.abilities.forPrincipal(principal);
    const subjectRecord = await find(this.prisma, descriptor, ability, principal, target.id);
    if (subjectRecord === null) {
      return { outcome: 'not_found' };
    }
    if (ability.can(target.action, subjectRecord)) {
      return { outcome: 'allowed' };
    }
    return {
      outcome: 'denied',
      code: reasonCode(ability.relevantRuleFor(target.action, subjectRecord)?.reason),
    };
  }
}

/** A record of a subject the principal can see, by its descriptor; `null` when invisible. */
function find<S extends RecordSubject>(
  prisma: PrismaService,
  descriptor: RecordDescriptor<S>,
  ability: AppAbility,
  principal: Principal,
  id: string,
) {
  // The Prisma filter of the subject `S`: TypeScript cannot resolve the filter type of
  // `accessibleBy` indexed by a type parameter, so it is named once here.
  const where = {
    AND: [accessibleBy(ability, 'read').ofType(descriptor.subject), { id }],
  } as RecordFilters[S];
  return descriptor.find(prisma, where, principal);
}

/** The error code a denying rule carries as its reason (§18.3); `403` without one. */
export function reasonCode(reason: string | undefined): ErrorCode {
  const code = errorCodeSchema.safeParse(reason);
  return code.success ? code.data : 'request.forbidden';
}
