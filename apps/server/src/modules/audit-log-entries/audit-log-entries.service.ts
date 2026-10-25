import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Clock } from '../../platform/clock/clock.js';
import { PrismaService, type Transaction } from '../../platform/database/prisma.service.js';

/** How long the client IP of an entry is kept (§13.2). */
export const IP_ADDRESS_RETENTION_MS = 14 * 24 * 60 * 60 * 1_000;

/**
 * The actions of the administrative audit log (§13.5), `resource.event` (§17.1). Feature tasks add
 * the actions they record.
 */
export type AuditAction = 'setup_token.used';

/** An entry of the audit log, written in the transaction of the change it records (§18.3). */
export interface AuditLogEntryInput {
  action: AuditAction;
  /** The account that acted; `null` for the system. */
  actorId: string | null;
  /** The record the action concerns: its Prisma model name and ID. */
  target: { type: string; id: string };
  /** The client IP, recorded for security events only (§13.5). */
  ipAddress?: string;
}

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
