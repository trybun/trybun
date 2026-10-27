import { Injectable } from '@nestjs/common';
import type { ProjectRole } from '@trybun/contracts/projects';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Clock } from '../../platform/clock/clock.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';

/** How long the client IP of an entry is kept (§13.2). */
export const IP_ADDRESS_RETENTION_MS = 14 * 24 * 60 * 60 * 1_000;

/**
 * The actions of the administrative audit log (§13.5), `resource.event` (§17.1), each with the type
 * of its `details`: further identifiers and non-personal values, never content or personal data
 * (§13.5); `null` for an action without details. Feature tasks add the actions they record.
 */
interface AuditDetailsByAction {
  'setup_token.used': null;
  'project.created': null;
  'project.archived': null;
  'project.unarchived': null;
  'project.deleted': null;
  'project_member.added': { userId: string; role: ProjectRole };
  'project_member.role_changed': { userId: string; role: ProjectRole; previousRole: ProjectRole };
  'project_member.removed': { userId: string; role: ProjectRole };
}

export type AuditAction = keyof AuditDetailsByAction;

/** An entry of one action: `details` exactly when the action has them. */
type AuditLogEntryOf<Action extends AuditAction> = {
  action: Action;
  /** The account that acted; `null` for the system. */
  actorId: string | null;
  /** The record the action concerns: its Prisma model name and ID. */
  target: { type: string; id: string };
  /** The client IP, recorded for security events only (§13.5). */
  ipAddress?: string;
} & (AuditDetailsByAction[Action] extends null
  ? { details?: never }
  : { details: AuditDetailsByAction[Action] });

/** An entry of the audit log, written in the transaction of the change it records (§18.3). */
export type AuditLogEntryInput = { [Action in AuditAction]: AuditLogEntryOf<Action> }[AuditAction];

/**
 * The administrative audit log (§13.5): entries are only ever added; the only change is the
 * removal of their IP after 14 days.
 */
@Injectable()
export class AuditLogEntriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @InjectPinoLogger(AuditLogEntriesService.name) private readonly logger: PinoLogger,
  ) {}

  async record(tx: Transaction, entry: AuditLogEntryInput): Promise<void> {
    await tx.auditLogEntry.create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        targetType: entry.target.type,
        targetId: entry.target.id,
        details: entry.details,
        ipAddress: entry.ipAddress ?? null,
      },
      select: { id: true },
    });
  }

  /**
   * Removes the IP of the entries older than 14 days (§13.2) and returns their number. A repeated
   * run finds no entries, so the run is idempotent.
   */
  async expireIpAddresses(): Promise<number> {
    const { count } = await this.prisma.auditLogEntry.updateMany({
      where: {
        ipAddress: { not: null },
        createdAt: { lt: new Date(this.clock.now().getTime() - IP_ADDRESS_RETENTION_MS) },
      },
      data: { ipAddress: null },
    });
    this.logger.info({ count }, 'IP addresses of the audit log removed');
    return count;
  }
}
