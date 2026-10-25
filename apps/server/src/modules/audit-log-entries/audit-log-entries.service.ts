import { Injectable } from '@nestjs/common';
import type { Transaction } from '../../platform/database/prisma.service.js';

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

/** The administrative audit log (§13.5): immutable entries, only ever added. */
@Injectable()
export class AuditLogEntriesService {
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
}
