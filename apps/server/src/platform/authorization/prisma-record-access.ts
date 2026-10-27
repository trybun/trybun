import { subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { Injectable } from '@nestjs/common';
import { type ErrorCode, errorCodeSchema } from '@trybun/contracts/errors';
import type { Principal } from '../authentication/principal.js';
import { PrismaService } from '../database/prisma.service.js';
import { type AppAbility, AbilityFactory, type ProjectRuleRecord } from './ability-factory.js';
import { RecordAccess, type RecordAccessDecision, type TargetRecord } from './record-access.js';

/**
 * The record access of the request pipeline (§18.3): the record is loaded only through the
 * `read` filter of the ability, so an invisible record is never loaded; the action is then
 * checked on it, and a denying rule with a reason (e.g. `project.archived`) answers with its code.
 * Subjects join as their rules arrive; the permission layer (S1-04) generalizes the lookup.
 */
@Injectable()
export class PrismaRecordAccess extends RecordAccess {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilities: AbilityFactory,
  ) {
    super();
  }

  async decide(principal: Principal, target: TargetRecord): Promise<RecordAccessDecision> {
    const ability = this.abilities.forPrincipal(principal);
    const record = await this.find(ability, principal, target);
    if (record === null) {
      return { outcome: 'not_found' };
    }
    const subjectRecord = subject(target.subject as 'Project', record);
    if (ability.can(target.action, subjectRecord)) {
      return { outcome: 'allowed' };
    }
    return {
      outcome: 'denied',
      code: reasonCode(ability.relevantRuleFor(target.action, subjectRecord)?.reason),
    };
  }

  private find(
    ability: AppAbility,
    principal: Principal,
    target: TargetRecord,
  ): Promise<ProjectRuleRecord | null> {
    switch (target.subject) {
      case 'Project':
        return this.prisma.project.findFirst({
          where: { AND: [accessibleBy(ability, 'read').ofType('Project'), { id: target.id }] },
          select: {
            id: true,
            state: true,
            members: {
              where: { userId: principal.userId },
              select: { userId: true, role: true },
            },
          },
        });
      default:
        return Promise.resolve(null);
    }
  }
}

/** The error code a denying rule carries as its reason (§18.3); `403` without one. */
export function reasonCode(reason: string | undefined): ErrorCode {
  const code = errorCodeSchema.safeParse(reason);
  return code.success ? code.data : 'request.forbidden';
}
