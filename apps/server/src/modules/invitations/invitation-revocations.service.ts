import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { Clock } from '../../platform/clock/clock.js';
import type { Transaction } from '../../platform/database/prisma.service.js';
import { AuditLogEntriesService } from '../audit-log-entries/audit-log-entries.service.js';
import { INVITATION } from './invitations.abilities.js';

/** Why the system revokes pending invitations as an effect of another change (§7.3, §7.4). */
export type RevocationCause = 'project_archived' | 'organization_archived' | 'user_deactivated';

/** The invitations that are pending at `now` (§7.4): neither accepted nor revoked, not expired. */
export function pendingInvitationWhere(now: Date): Prisma.InvitationWhereInput {
  return { usedAt: null, revokedAt: null, expiresAt: { gt: now } };
}

/**
 * Revokes pending invitations as an effect of a change of another module, in that module's
 * transaction (§7.3, §7.4): archiving a project or an organization, deactivating an account. A
 * module of its own, so the projects and organizations modules can use it while the invitations
 * module uses their services – without a cycle (§18.3).
 */
@Injectable()
export class InvitationRevocationsService {
  constructor(
    private readonly clock: Clock,
    private readonly auditLog: AuditLogEntriesService,
  ) {}

  /** The pending invitations of a project (§7.3). */
  revokeForProject(tx: Transaction, projectId: string): Promise<void> {
    return this.revoke(tx, { target: 'project', projectId }, 'project_archived');
  }

  /**
   * The pending invitations to an organization (§7.3). Project invitations that matched it by the
   * e-mail domain stay: their acceptance gives personal access to the project instead.
   */
  revokeForOrganization(tx: Transaction, organizationId: string): Promise<void> {
    return this.revoke(tx, { target: 'organization', organizationId }, 'organization_archived');
  }

  /** The pending invitations of an account, e.g. when it is deactivated (§7.4). */
  revokeForUser(tx: Transaction, userId: string): Promise<void> {
    return this.revoke(tx, { userId }, 'user_deactivated');
  }

  /**
   * Revokes the pending invitations matching `where` with an audit entry of the system for each.
   * Expired ones are left as they are: they can no longer be accepted, and `revoked` would hide
   * that they expired.
   */
  private async revoke(
    tx: Transaction,
    where: Prisma.InvitationWhereInput,
    reason: RevocationCause,
  ): Promise<void> {
    const now = this.clock.now();
    const pending = { ...where, ...pendingInvitationWhere(now) };
    const invitations = await tx.invitation.findMany({
      where: pending,
      select: { id: true, userId: true },
      orderBy: { id: 'asc' },
    });
    if (invitations.length === 0) {
      return;
    }
    await tx.invitation.updateMany({
      where: { ...pending, id: { in: invitations.map(({ id }) => id) } },
      data: { revokedAt: now },
    });
    for (const { id, userId } of invitations) {
      await this.auditLog.record(tx, {
        action: 'invitation.revoked',
        actorId: null,
        target: { type: INVITATION, id },
        details: { userId, reason },
      });
    }
  }
}
