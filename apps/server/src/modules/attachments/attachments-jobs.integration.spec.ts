// The Worker side of attachments (§13.3, ADR 0008 as amended by Q10, Q21 and Q22; S1-08 step 6):
// the scan with the move and EXIF stripping, the reconciliation of rows and objects, the recovery
// of lost scans and the purge, against PostgreSQL (a database of its own, because the purge reads
// every draft), SeaweedFS and the pinned ClamAV image. The jobs are invoked directly.
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { crc32, deflateSync } from 'node:zlib';
import type { INestApplicationContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Job } from 'bullmq';
import sharp from 'sharp';
import { afterAll, afterEach, beforeAll, describe, expect, inject, it, vi } from 'vitest';
import { startClamav, type TestClamav } from '../../../test/clamav/clamav.js';
import { TEST_ENV } from '../../../test/env.js';
import { createAttachment } from '../../../test/factories/attachment.factory.js';
import { createProject } from '../../../test/factories/project.factory.js';
import { createTicket } from '../../../test/factories/ticket.factory.js';
import { createUser } from '../../../test/factories/user.factory.js';
import { zipArchive } from '../../../test/files/zip.js';
import { captureLogs } from '../../../test/logging/captured-logs.js';
import { createOwnDatabase } from '../../../test/setup/own-database.js';
import type { Attachment, User } from '../../generated/prisma/client.js';
import { ClamavModule } from '../../platform/clamav/clamav.module.js';
import { MALWARE_SCANNER, type MalwareScanner } from '../../platform/clamav/malware-scanner.js';
import { Clock } from '../../platform/clock/clock.js';
import { ClockModule } from '../../platform/clock/clock.module.js';
import { ConfigModule } from '../../platform/config/config.module.js';
import { loadConfig } from '../../platform/config/load-config.js';
import { DatabaseModule } from '../../platform/database/database.module.js';
import { PrismaService } from '../../platform/database/prisma.service.js';
import { AppError } from '../../platform/errors/app-error.js';
import { LOG_DESTINATION, LoggingModule } from '../../platform/logging/logging.module.js';
import { OutboxModule } from '../../platform/outbox/outbox.module.js';
import {
  availableKey,
  OBJECT_STORAGE,
  type ObjectStorage,
  quarantineKey,
} from '../../platform/storage/object-storage.js';
import { StorageWorkerModule } from '../../platform/storage/storage-worker.module.js';
import { AttachmentPurgeService } from './attachment-purge.service.js';
import { AttachmentScanService } from './attachment-scan.service.js';
import {
  ATTACHMENT_AVAILABLE,
  ATTACHMENT_DELETED,
  ATTACHMENT_INFECTED,
  ATTACHMENT_REJECTED,
  ATTACHMENT_UPLOADED,
} from './attachments.events.js';
import {
  DeleteAttachmentObjectsProcessor,
  PurgeAttachmentsProcessor,
  RecoverAttachmentScansProcessor,
  ScanAttachmentProcessor,
} from './attachments.processor.js';
import { ImageReencoder } from './image-reencoder.js';

const NOW = new Date('2026-11-05T10:00:00.000Z');
const MINUTE_MS = 60 * 1_000;
const HOUR_MS = 60 * MINUTE_MS;

/** The EICAR test file, encoded so that no scanner flags this source file. */
const EICAR = Buffer.from(
  'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
  'base64',
);
const TEXT = Buffer.from('A plain text attachment.\n');
const MB = 1024 * 1024;

/** An address where nothing listens: ClamAV is down. */
const CLOSED_PORT_URL = 'tcp://127.0.0.1:1';

class TestClock extends Clock {
  current = NOW;

  now(): Date {
    return this.current;
  }
}

/** One Worker: the jobs of attachments with the scanner at the given address. */
interface Worker {
  app: INestApplicationContext;
  scanner: MalwareScanner;
  scan: ScanAttachmentProcessor;
  deleteObjects: DeleteAttachmentObjectsProcessor;
  recover: RecoverAttachmentScansProcessor;
  purge: PurgeAttachmentsProcessor;
}

function job(data: object): Job {
  return { id: randomUUID(), data } as Job;
}

/** A PNG chunk: length, type, data and its CRC (PNG specification). */
function pngChunk(type: string, data: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(data.length, 0);
  header.write(type, 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([header.subarray(4), data])), 0);
  return Buffer.concat([header, data, crc]);
}

/**
 * A grey PNG of the given size whose rows are all zero: a decompression bomb of a few kilobytes
 * per megapixel.
 */
function blankPng(width: number, height: number): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  // 8 bits, greyscale, deflate, no filter method, no interlace.
  header.writeUInt8(8, 8);
  const rows = deflateSync(Buffer.alloc((width + 1) * height), { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', rows),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A JPEG of 40 × 20 pixels with GPS EXIF data and the EXIF orientation "rotate 90° clockwise". */
async function jpegWithGpsExif(): Promise<Buffer> {
  const jpeg = await sharp({
    create: { width: 40, height: 20, channels: 3, background: '#336699' },
  })
    .jpeg()
    .withExif({
      IFD0: { Copyright: 'Trybun test' },
      IFD3: {
        GPSLatitudeRef: 'N',
        GPSLatitude: '52/1 13/1 0/1',
        GPSLongitudeRef: 'E',
        GPSLongitude: '21/1 0/1 0/1',
      },
    })
    .toBuffer();
  return sharp(jpeg).withMetadata({ orientation: 6 }).toBuffer();
}

/** Whether EXIF data holds the pointer to a GPS IFD (tag 0x8825, TIFF in either byte order). */
function hasGpsIfd(exif: Buffer): boolean {
  return exif.includes(Buffer.from([0x88, 0x25])) || exif.includes(Buffer.from([0x25, 0x88]));
}

/** An animated GIF of three frames of 30 × 10 pixels. */
async function animatedGif(): Promise<Buffer> {
  const frames = await Promise.all(
    ['#ff0000', '#00ff00', '#0000ff'].map((background) =>
      sharp({ create: { width: 30, height: 10, channels: 4, background } })
        .png()
        .toBuffer(),
    ),
  );
  return sharp(frames, { join: { animated: true } })
    .gif({ delay: [100, 100, 100] })
    .toBuffer();
}

describe('attachment jobs', () => {
  const logs = captureLogs();
  const clock = new TestClock();
  let clamav: TestClamav;
  let up: Worker;
  let down: Worker;
  let prisma: PrismaService;
  let storage: ObjectStorage;
  let uploader: User;

  async function startWorker(databaseUrl: string, clamavUrl: string): Promise<Worker> {
    const config = loadConfig({
      ...TEST_ENV,
      DATABASE_URL: databaseUrl,
      TRYBUN_VALKEY_URL: inject('valkeyUrl'),
      // A bucket of its own: the purge lists every object.
      TRYBUN_S3_URL: `${inject('storageEndpoint')}/attachment-jobs`,
      TRYBUN_CLAMAV_URL: clamavUrl,
      TRYBUN_LOG_LEVEL: 'info',
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot(config),
        LoggingModule.forRoot(),
        ClockModule,
        DatabaseModule,
        OutboxModule,
        StorageWorkerModule,
        ClamavModule,
      ],
      providers: [
        AttachmentScanService,
        AttachmentPurgeService,
        ImageReencoder,
        ScanAttachmentProcessor,
        DeleteAttachmentObjectsProcessor,
        RecoverAttachmentScansProcessor,
        PurgeAttachmentsProcessor,
      ],
    })
      .overrideProvider(Clock)
      .useValue(clock)
      .overrideProvider(LOG_DESTINATION)
      .useValue(logs)
      .compile();
    const app = await moduleRef.init();
    return {
      app,
      scanner: app.get<MalwareScanner>(MALWARE_SCANNER),
      scan: app.get(ScanAttachmentProcessor),
      deleteObjects: app.get(DeleteAttachmentObjectsProcessor),
      recover: app.get(RecoverAttachmentScansProcessor),
      purge: app.get(PurgeAttachmentsProcessor),
    };
  }

  beforeAll(async () => {
    const [databaseUrl, startedClamav] = await Promise.all([createOwnDatabase(), startClamav()]);
    clamav = startedClamav;
    up = await startWorker(databaseUrl, clamav.url);
    down = await startWorker(databaseUrl, CLOSED_PORT_URL);
    prisma = up.app.get(PrismaService);
    storage = up.app.get<ObjectStorage>(OBJECT_STORAGE);
    await storage.ensureBucket();
    uploader = await createUser(prisma);
  }, 300_000);

  afterEach(() => {
    clock.current = NOW;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await Promise.all([up.app.close(), down.app.close()]);
    await clamav.container.stop();
  });

  /** A draft in quarantine with its object, uploaded 5 minutes ago. */
  async function quarantined(
    content: Buffer,
    input: Partial<Pick<Attachment, 'contentType' | 'fileName' | 'createdAt' | 'updatedAt'>> = {},
  ): Promise<Attachment> {
    const createdAt = input.createdAt ?? new Date(NOW.getTime() - 5 * MINUTE_MS);
    const row = await createAttachment(prisma, {
      contentType: 'text/plain; charset=utf-8',
      ...input,
      size: content.length,
      uploadedById: uploader.id,
      createdAt,
      updatedAt: input.updatedAt ?? createdAt,
    });
    await storage.put(quarantineKey(row.id), Readable.from([content]));
    return row;
  }

  function scan(worker: Worker, attachmentId: string): Promise<void> {
    return worker.scan.process(job({ payload: { attachmentId }, requestId: null }));
  }

  /** Which objects of an attachment exist. */
  async function objectsOf(attachmentId: string) {
    const [quarantine, available] = await Promise.all([
      storage.head(quarantineKey(attachmentId)),
      storage.head(availableKey(attachmentId)),
    ]);
    return { quarantine: quarantine !== null, available: available !== null };
  }

  async function availableContent(attachmentId: string): Promise<Buffer> {
    const content = await storage.get(availableKey(attachmentId));
    expect(content).not.toBeNull();
    return buffer(content?.body ?? Readable.from([]));
  }

  /** The outbox events of an attachment, oldest first. */
  async function eventsOf(attachmentId: string) {
    const events = await prisma.outboxEvent.findMany({
      where: { payload: { path: ['attachmentId'], equals: attachmentId } },
      orderBy: { id: 'asc' },
      select: { type: true, payload: true },
    });
    return events;
  }

  function scanned(type: string, row: Attachment) {
    return { type, payload: { attachmentId: row.id, uploadedById: row.uploadedById } };
  }

  async function statusOf(attachmentId: string) {
    return (await prisma.attachment.findUniqueOrThrow({ where: { id: attachmentId } })).status;
  }

  describe('the scan', () => {
    it('removes an infected file after marking its row, and logs the signature only', async () => {
      const row = await quarantined(EICAR, { fileName: 'invoice-kowalski.txt' });

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('infected');
      expect(await eventsOf(row.id)).toEqual([scanned(ATTACHMENT_INFECTED, row)]);
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
      const lines = logs.lines.filter((line) => line.attachmentId === row.id);
      expect(lines).toContainEqual(
        expect.objectContaining({ status: 'infected', signature: 'Eicar-Test-Signature' }),
      );
      expect(JSON.stringify(lines)).not.toContain('kowalski');
    });

    it('moves a clean file to available/ once, with its event', async () => {
      const row = await quarantined(TEXT);

      await scan(up, row.id);
      // A duplicate delivery ends without effect.
      await scan(up, row.id);

      const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored).toMatchObject({ status: 'available', size: TEXT.length, updatedAt: NOW });
      expect((await availableContent(row.id)).equals(TEXT)).toBe(true);
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: true });
      expect(await eventsOf(row.id)).toEqual([scanned(ATTACHMENT_AVAILABLE, row)]);
    });

    it('strips the EXIF data of a JPEG, keeps its orientation and stores the new size', async () => {
      const jpeg = await jpegWithGpsExif();
      const original = await sharp(jpeg).metadata();
      expect(original).toMatchObject({ width: 40, height: 20, orientation: 6 });
      expect(hasGpsIfd(original.exif ?? Buffer.alloc(0))).toBe(true);
      const row = await quarantined(jpeg, { contentType: 'image/jpeg', fileName: 'photo.jpg' });

      await scan(up, row.id);

      const content = await availableContent(row.id);
      const metadata = await sharp(content).metadata();
      expect(metadata).toMatchObject({ format: 'jpeg', width: 20, height: 40 });
      expect(metadata.exif).toBeUndefined();
      expect(metadata.orientation).toBeUndefined();
      expect(metadata.icc).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored).toMatchObject({ status: 'available', size: content.length });
      expect(content.length).not.toBe(jpeg.length);
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: true });
    });

    it('keeps every frame of an animated GIF', async () => {
      const row = await quarantined(await animatedGif(), { contentType: 'image/gif' });

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('available');
      const metadata = await sharp(await availableContent(row.id)).metadata();
      expect(metadata).toMatchObject({ format: 'gif', width: 30, height: 10, pages: 3 });
    });

    it('rejects a small PNG with huge dimensions without decoding it', async () => {
      // 64 megapixels in about 60 KB.
      const bomb = blankPng(8000, 8000);
      expect(bomb.length).toBeLessThan(MB);
      const row = await quarantined(bomb, { contentType: 'image/png' });

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('rejected');
      expect(await eventsOf(row.id)).toEqual([scanned(ATTACHMENT_REJECTED, row)]);
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
      expect(logs.lines).toContainEqual(
        expect.objectContaining({ attachmentId: row.id, status: 'rejected', reason: 'too_large' }),
      );
    });

    it('rejects an image sharp cannot decode', async () => {
      const truncated = blankPng(100, 100).subarray(0, 60);
      const row = await quarantined(truncated, { contentType: 'image/png' });

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('rejected');
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
    });

    // clamd unpacks up to MaxScanSize (400 MB) before it reports the archive.
    it('rejects a ZIP whose content exceeds the scan limits', async () => {
      const archive = zipArchive([
        { name: 'zeros.bin', content: Buffer.alloc(402 * MB), isDeflated: true },
      ]);
      const row = await quarantined(archive, { contentType: 'application/zip' });

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('rejected');
      expect(await eventsOf(row.id)).toEqual([scanned(ATTACHMENT_REJECTED, row)]);
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
    }, 120_000);

    it('keeps the file in quarantine when ClamAV is down, so BullMQ retries', async () => {
      const row = await quarantined(TEXT);

      await expect(scan(down, row.id)).rejects.toThrow(new AppError('server.unavailable'));

      expect(await statusOf(row.id)).toBe('quarantine');
      expect(await objectsOf(row.id)).toEqual({ quarantine: true, available: false });
      expect(await eventsOf(row.id)).toEqual([]);
    });

    it('deletes what it wrote when the attachment is deleted during its scan', async () => {
      const row = await quarantined(TEXT);
      const scanFile = up.scanner.scan.bind(up.scanner);
      // The API deletes the row with its event; the event's job has not run yet.
      vi.spyOn(up.scanner, 'scan').mockImplementationOnce(async (content) => {
        const result = await scanFile(content);
        await prisma.attachment.delete({ where: { id: row.id } });
        return result;
      });

      await scan(up, row.id);

      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
      expect(await eventsOf(row.id)).toEqual([]);
    });

    it('writes nothing when the objects of an image are deleted during its scan', async () => {
      const row = await quarantined(await jpegWithGpsExif(), { contentType: 'image/jpeg' });
      const scanFile = up.scanner.scan.bind(up.scanner);
      // The row is deleted and its event's job deletes the objects at once.
      vi.spyOn(up.scanner, 'scan').mockImplementationOnce(async (content) => {
        const result = await scanFile(content);
        await prisma.attachment.delete({ where: { id: row.id } });
        await up.deleteObjects.process(job({ payload: { attachmentId: row.id }, requestId: null }));
        return result;
      });

      await scan(up, row.id);

      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
    });
  });

  describe('rows and objects out of step (Q21)', () => {
    it('finishes the move of a row whose object is already in available/', async () => {
      const row = await createAttachment(prisma, { uploadedById: uploader.id, size: 1 });
      await storage.put(availableKey(row.id), Readable.from([TEXT]));

      await scan(up, row.id);

      const stored = await prisma.attachment.findUniqueOrThrow({ where: { id: row.id } });
      expect(stored).toMatchObject({ status: 'available', size: TEXT.length });
      expect(await eventsOf(row.id)).toEqual([scanned(ATTACHMENT_AVAILABLE, row)]);
    });

    it('rejects a row in quarantine without any object', async () => {
      const row = await createAttachment(prisma, { uploadedById: uploader.id });

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('rejected');
      expect(await eventsOf(row.id)).toEqual([scanned(ATTACHMENT_REJECTED, row)]);
    });

    it('leaves a row no longer in quarantine unchanged', async () => {
      const row = await createAttachment(prisma, { uploadedById: uploader.id, status: 'infected' });
      // A copy an earlier attempt left behind.
      await storage.put(quarantineKey(row.id), Readable.from([TEXT]));

      await scan(up, row.id);

      expect(await statusOf(row.id)).toBe('infected');
      expect(await eventsOf(row.id)).toEqual([]);
      expect(await objectsOf(row.id)).toEqual({ quarantine: false, available: false });
    });
  });

  describe('the recovery of lost scans (Q10)', () => {
    it('re-enqueues a stuck scan only while ClamAV answers, which then releases the file', async () => {
      const stuck = await quarantined(TEXT, {
        createdAt: new Date(NOW.getTime() - HOUR_MS),
        updatedAt: new Date(NOW.getTime() - 16 * MINUTE_MS),
      });
      const recent = await quarantined(TEXT, {
        createdAt: new Date(NOW.getTime() - HOUR_MS),
        updatedAt: new Date(NOW.getTime() - 14 * MINUTE_MS),
      });

      // ClamAV is down: nothing is enqueued, the file stays in quarantine.
      await down.recover.process(job({}));
      await expect(scan(down, stuck.id)).rejects.toThrow(new AppError('server.unavailable'));
      expect(await eventsOf(stuck.id)).toEqual([]);
      expect(await prisma.attachment.findUniqueOrThrow({ where: { id: stuck.id } })).toMatchObject({
        status: 'quarantine',
        updatedAt: stuck.updatedAt,
      });

      // ClamAV is back.
      await up.recover.process(job({}));
      expect(await eventsOf(stuck.id)).toEqual([
        { type: ATTACHMENT_UPLOADED, payload: { attachmentId: stuck.id } },
      ]);
      expect(await prisma.attachment.findUniqueOrThrow({ where: { id: stuck.id } })).toMatchObject({
        status: 'quarantine',
        updatedAt: NOW,
      });
      expect(await eventsOf(recent.id)).toEqual([]);
      // A second run within 15 minutes enqueues nothing more.
      await up.recover.process(job({}));
      expect(await eventsOf(stuck.id)).toHaveLength(1);

      await scan(up, stuck.id);
      expect(await statusOf(stuck.id)).toBe('available');
    });

    it('rejects a file still in quarantine 24 hours after its upload, only while ClamAV answers', async () => {
      const expired = await quarantined(TEXT, {
        createdAt: new Date(NOW.getTime() - 24 * HOUR_MS),
        updatedAt: new Date(NOW.getTime() - 20 * MINUTE_MS),
      });

      await down.recover.process(job({}));
      expect(await statusOf(expired.id)).toBe('quarantine');

      await up.recover.process(job({}));
      expect(await statusOf(expired.id)).toBe('rejected');
      expect(await eventsOf(expired.id)).toEqual([scanned(ATTACHMENT_REJECTED, expired)]);
      expect(await objectsOf(expired.id)).toEqual({ quarantine: false, available: false });
    });
  });

  describe('the purge', () => {
    async function linked(createdAt: Date): Promise<Attachment> {
      const project = await createProject(prisma);
      const ticket = await createTicket(prisma, {
        projectId: project.id,
        requesterId: uploader.id,
      });
      return createAttachment(prisma, {
        uploadedById: uploader.id,
        ticketId: ticket.id,
        status: 'available',
        createdAt,
      });
    }

    it('deletes drafts after 24 hours with an event whose job deletes their objects', async () => {
      const old = await quarantined(TEXT, { createdAt: new Date(NOW.getTime() - 25 * HOUR_MS) });
      await storage.put(availableKey(old.id), Readable.from([TEXT]));
      const recent = await quarantined(TEXT, { createdAt: new Date(NOW.getTime() - 23 * HOUR_MS) });
      const oldLinked = await linked(new Date(NOW.getTime() - 48 * HOUR_MS));

      await up.purge.process(job({}));

      expect(await prisma.attachment.findUnique({ where: { id: old.id } })).toBeNull();
      const events = await eventsOf(old.id);
      expect(events).toEqual([{ type: ATTACHMENT_DELETED, payload: { attachmentId: old.id } }]);
      expect(await prisma.attachment.findUnique({ where: { id: recent.id } })).not.toBeNull();
      expect(await prisma.attachment.findUnique({ where: { id: oldLinked.id } })).not.toBeNull();
      // The objects of a deleted row are removed by its event's job only, which is idempotent.
      expect(await objectsOf(old.id)).toEqual({ quarantine: true, available: true });
      const deletion = job({ payload: events[0]?.payload, requestId: null });
      await up.deleteObjects.process(deletion);
      await up.deleteObjects.process(deletion);
      expect(await objectsOf(old.id)).toEqual({ quarantine: false, available: false });
      expect(await objectsOf(recent.id)).toEqual({ quarantine: true, available: false });
    });

    it('deletes objects without a row 24 hours after they were written', async () => {
      const [inQuarantine, inAvailable] = [randomUUID(), randomUUID()];
      await storage.put(quarantineKey(inQuarantine), Readable.from([TEXT]));
      await storage.put(availableKey(inAvailable), Readable.from([TEXT]));
      const kept = await linked(new Date());
      await storage.put(availableKey(kept.id), Readable.from([TEXT]));
      // The storage dates objects with the real time.
      const written = Date.now();

      clock.current = new Date(written + 23 * HOUR_MS);
      await up.purge.process(job({}));
      expect(await objectsOf(inQuarantine)).toEqual({ quarantine: true, available: false });
      expect(await objectsOf(inAvailable)).toEqual({ quarantine: false, available: true });

      clock.current = new Date(written + 25 * HOUR_MS);
      await up.purge.process(job({}));
      expect(await objectsOf(inQuarantine)).toEqual({ quarantine: false, available: false });
      expect(await objectsOf(inAvailable)).toEqual({ quarantine: false, available: false });
      expect(await objectsOf(kept.id)).toEqual({ quarantine: false, available: true });
    });
  });
});
