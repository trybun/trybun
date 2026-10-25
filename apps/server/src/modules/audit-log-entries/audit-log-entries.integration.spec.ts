import { randomUUID } from 'node:crypto';
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Job, Queue } from 'bullmq';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { captureLogs } from '../../../test/logging/captured-logs.js';
import { integrationConfig } from '../../../test/setup/config.js';
import { Clock } from '../../platform/clock/clock.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { LOG_DESTINATION, LoggingModule } from '../../platform/logging/logging.module.js';
import { QueuesModule } from '../../platform/queues/queues.module.js';
import { AuditLogEntriesWorkerModule } from './audit-log-entries-worker.module.js';
import { AUDIT_LOG_ENTRIES_QUEUE, AUDIT_LOG_IP_EXPIRY_JOB } from './audit-log-entries.jobs.js';
import { AuditLogEntriesProcessor } from './audit-log-entries.processor.js';
import { AuditLogEntriesService, IP_ADDRESS_RETENTION_MS } from './audit-log-entries.service.js';

const IP_ADDRESS = '2001:db8::1';

describe('audit log', () => {
  const now = new Date();
  const logs = captureLogs();
  let app: INestApplicationContext;
  let auditLog: AuditLogEntriesService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ...integrationConfig(), logLevel: 'info' }),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        QueuesModule,
        AuditLogEntriesWorkerModule,
      ],
    })
      .overrideProvider(Clock)
      .useValue({ now: () => now })
      .overrideProvider(LOG_DESTINATION)
      .useValue(logs)
      .compile();
    app = await moduleRef.init();
    auditLog = app.get(AuditLogEntriesService);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function recordEntry(): Promise<string> {
    const targetId = randomUUID();
    await prisma.$transaction((tx) =>
      auditLog.record(tx, {
        action: 'setup_token.used',
        actorId: targetId,
        target: { type: 'User', id: targetId },
        ipAddress: IP_ADDRESS,
      }),
    );
    return targetId;
  }

  /** An entry of a security event created the given time before now; returns its ID. */
  async function createEntryAged(ageMs: number): Promise<string> {
    const targetId = randomUUID();
    const { id } = await prisma.auditLogEntry.create({
      data: {
        action: 'setup_token.used',
        actorId: targetId,
        targetType: 'User',
        targetId,
        ipAddress: IP_ADDRESS,
        createdAt: new Date(now.getTime() - ageMs),
      },
      select: { id: true },
    });
    return id;
  }

  it('records an entry with author, target, client IP and timestamp', async () => {
    const before = Date.now();

    const targetId = await recordEntry();

    const entry = await prisma.auditLogEntry.findFirstOrThrow({ where: { targetId } });
    expect(entry).toMatchObject({
      action: 'setup_token.used',
      actorId: targetId,
      targetType: 'User',
      ipAddress: IP_ADDRESS,
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
    [
      'given another IP',
      (targetId: string) =>
        prisma.auditLogEntry.updateMany({ where: { targetId }, data: { ipAddress: '192.0.2.1' } }),
    ],
    [
      'updated together with the removal of its IP',
      (targetId: string) =>
        prisma.auditLogEntry.updateMany({
          where: { targetId },
          data: { ipAddress: null, action: 'setup_token.issued' },
        }),
    ],
    ['deleted', (targetId: string) => prisma.auditLogEntry.deleteMany({ where: { targetId } })],
    ['truncated', () => prisma.$executeRaw`TRUNCATE audit_log_entries`],
  ])('cannot be %s', async (_case, change) => {
    const targetId = await recordEntry();

    await expect(change(targetId)).rejects.toThrow(/audit log is immutable/);

    expect(
      await prisma.auditLogEntry.count({
        where: { targetId, actorId: targetId, ipAddress: IP_ADDRESS },
      }),
    ).toBe(1);
  });

  it('refuses an update of an entry without an IP', async () => {
    const targetId = randomUUID();
    await prisma.$transaction((tx) =>
      auditLog.record(tx, {
        action: 'setup_token.used',
        actorId: null,
        target: { type: 'User', id: targetId },
      }),
    );

    await expect(
      prisma.auditLogEntry.updateMany({ where: { targetId }, data: { ipAddress: null } }),
    ).rejects.toThrow(/audit log is immutable/);
  });

  it('removes the IP of entries older than 14 days and keeps the entries', async () => {
    const expired = await createEntryAged(IP_ADDRESS_RETENTION_MS + 1);
    const kept = await createEntryAged(IP_ADDRESS_RETENTION_MS);

    await app
      .get(AuditLogEntriesProcessor)
      .process({ id: 'audit-log-ip-expiry-test', data: {} } as Job);

    const entries = await prisma.auditLogEntry.findMany({
      where: { id: { in: [expired, kept] } },
      select: { id: true, action: true, ipAddress: true },
    });
    expect(entries).toEqual(
      expect.arrayContaining([
        { id: expired, action: 'setup_token.used', ipAddress: null },
        { id: kept, action: 'setup_token.used', ipAddress: IP_ADDRESS },
      ]),
    );
    expect(entries).toHaveLength(2);
  });

  it('changes nothing when run again', async () => {
    await createEntryAged(IP_ADDRESS_RETENTION_MS + 1);
    await auditLog.expireIpAddresses();

    await expect(auditLog.expireIpAddresses()).resolves.toBe(0);
  });

  it('logs the number of removed IPs, never an IP', async () => {
    await createEntryAged(IP_ADDRESS_RETENTION_MS + 1);

    await auditLog.expireIpAddresses();

    expect(logs.lines).toContainEqual(
      expect.objectContaining({ msg: 'IP addresses of the audit log removed', count: 1 }),
    );
    expect(JSON.stringify(logs.lines)).not.toContain(IP_ADDRESS);
  });

  it('schedules the removal once per hour, with one scheduler for several Worker replicas', async () => {
    const queue: Queue = app.get(getQueueToken(AUDIT_LOG_ENTRIES_QUEUE));

    // A second replica starting registers the same scheduler again.
    await app.get(AuditLogEntriesWorkerModule).onApplicationBootstrap();

    const schedulers = await queue.getJobSchedulers();
    expect(schedulers).toEqual([
      expect.objectContaining({
        key: AUDIT_LOG_IP_EXPIRY_JOB,
        name: AUDIT_LOG_IP_EXPIRY_JOB,
        every: 60 * 60 * 1_000,
      }),
    ]);
  });
});
