import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { integrationConfig } from '../../../test/setup/config.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { AuditLogEntriesService } from './audit-log-entries.service.js';

describe('audit log', () => {
  const auditLog = new AuditLogEntriesService();
  let prisma: PrismaService;

  beforeAll(() => {
    prisma = new PrismaService(integrationConfig());
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function recordEntry(): Promise<string> {
    const targetId = randomUUID();
    await prisma.$transaction((tx) =>
      auditLog.record(tx, {
        action: 'setup_token.used',
        actorId: targetId,
        target: { type: 'User', id: targetId },
        ipAddress: '2001:db8::1',
      }),
    );
    return targetId;
  }

  it('records an entry with author, target, client IP and timestamp', async () => {
    const before = Date.now();

    const targetId = await recordEntry();

    const entry = await prisma.auditLogEntry.findFirstOrThrow({ where: { targetId } });
    expect(entry).toMatchObject({
      action: 'setup_token.used',
      actorId: targetId,
      targetType: 'User',
      ipAddress: '2001:db8::1',
    });
    expect(entry.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1_000);
  });

  it('is not written when the transaction of the change rolls back', async () => {
    const targetId = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await auditLog.record(tx, {
          action: 'setup_token.used',
          actorId: null,
          target: { type: 'User', id: targetId },
        });
        throw new Error('The change failed');
      }),
    ).rejects.toThrow('The change failed');

    expect(await prisma.auditLogEntry.count({ where: { targetId } })).toBe(0);
  });

  it.each([
    [
      'updated',
      (targetId: string) =>
        prisma.auditLogEntry.updateMany({ where: { targetId }, data: { actorId: null } }),
    ],
    ['deleted', (targetId: string) => prisma.auditLogEntry.deleteMany({ where: { targetId } })],
    ['truncated', () => prisma.$executeRaw`TRUNCATE audit_log_entries`],
  ])('cannot be %s', async (_case, change) => {
    const targetId = await recordEntry();

    await expect(change(targetId)).rejects.toThrow(/audit log is immutable/);

    expect(await prisma.auditLogEntry.count({ where: { targetId, actorId: targetId } })).toBe(1);
  });
});
