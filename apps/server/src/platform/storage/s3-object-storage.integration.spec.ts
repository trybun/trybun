// The adapter of the object storage against SeaweedFS of the global set-up (§15.3, ADR 0008).
import { randomBytes, randomUUID } from 'node:crypto';
import { buffer } from 'node:stream/consumers';
import { Readable } from 'node:stream';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { ConfigModule } from '../config/config.module.js';
import { loadConfig } from '../config/load-config.js';
import { AppError } from '../errors/app-error.js';
import { LoggingModule } from '../logging/logging.module.js';
import {
  AVAILABLE_PREFIX,
  availableKey,
  OBJECT_STORAGE,
  type ObjectInfo,
  type ObjectStorage,
  QUARANTINE_PREFIX,
  quarantineKey,
} from './object-storage.js';
import { StorageWorkerModule } from './storage-worker.module.js';

/** An address where nothing listens. */
const CLOSED_PORT_URL = 'http://127.0.0.1:1/trybun';

async function startStorage(
  env: Record<string, string>,
): Promise<{ app: INestApplicationContext; storage: ObjectStorage }> {
  const app = await NestFactory.createApplicationContext(
    {
      module: class StorageTestModule {},
      imports: [
        ConfigModule.forRoot(loadConfig({ ...TEST_ENV, ...env })),
        LoggingModule.forRoot(),
        StorageWorkerModule,
      ],
    },
    { logger: false, abortOnError: false },
  );
  await app.init();
  return { app, storage: app.get<ObjectStorage>(OBJECT_STORAGE) };
}

async function listAll(storage: ObjectStorage, prefix: string): Promise<ObjectInfo[]> {
  const objects: ObjectInfo[] = [];
  for await (const object of storage.list(prefix)) {
    objects.push(object);
  }
  return objects;
}

async function contentOf(storage: ObjectStorage, key: string): Promise<Buffer | null> {
  const content = await storage.get(key);
  return content && buffer(content.body);
}

describe('S3ObjectStorage', () => {
  const apps: INestApplicationContext[] = [];
  // A bucket of its own, so other test files never see its objects.
  const bucketUrl = `${inject('storageEndpoint')}/storage-${randomUUID()}`;
  let storage: ObjectStorage;
  let bucket: ObjectStorage;

  beforeAll(async () => {
    const started = await startStorage({ TRYBUN_S3_URL: `${bucketUrl}/trybun/files` });
    // The same bucket without the folder, to see where the objects are.
    const root = await startStorage({ TRYBUN_S3_URL: bucketUrl });
    apps.push(started.app, root.app);
    storage = started.storage;
    bucket = root.storage;
    await storage.ensureBucket();
  });

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it('creates a missing bucket and then finds it', async () => {
    const { app, storage: fresh } = await startStorage({
      TRYBUN_S3_URL: `${inject('storageEndpoint')}/storage-${randomUUID()}`,
    });
    apps.push(app);
    const signal = () => AbortSignal.timeout(2_000);
    expect(await fresh.isAvailable(signal())).toBe(false);

    expect(await fresh.ensureBucket()).toBe(true);
    expect(await fresh.ensureBucket()).toBe(true);
    expect(await fresh.isAvailable(signal())).toBe(true);
  });

  it('streams a file of several parts into the folder and reads it back', async () => {
    const id = randomUUID();
    // Three parts of 5 MB.
    const content = randomBytes(12 * 1024 * 1024);

    await storage.put(quarantineKey(id), Readable.from([content]));

    // `equals` instead of a deep equality, which compares 12 MB byte by byte in seconds.
    expect((await contentOf(storage, quarantineKey(id)))?.equals(content)).toBe(true);
    expect(await storage.head(quarantineKey(id))).toEqual({
      key: `quarantine/${id}`,
      size: content.length,
      lastModified: expect.any(Date) as unknown,
    });
    expect(await bucket.head(`trybun/files/quarantine/${id}`)).toMatchObject({
      size: content.length,
    });
  });

  it('reads a range of an object', async () => {
    const id = randomUUID();
    await storage.put(quarantineKey(id), Readable.from([Buffer.from('0123456789')]));

    const range = await storage.get(quarantineKey(id), { start: 2, end: 5 });

    expect(range?.size).toBe(4);
    expect(range && (await buffer(range.body)).toString()).toBe('2345');
  });

  it('reports a missing object as null', async () => {
    const id = randomUUID();

    expect(await storage.get(availableKey(id))).toBeNull();
    expect(await storage.get(availableKey(id), { start: 0, end: 9 })).toBeNull();
    expect(await storage.head(availableKey(id))).toBeNull();
  });

  it('copies an object and deletes both, a missing one included', async () => {
    const id = randomUUID();
    await storage.put(quarantineKey(id), Readable.from([Buffer.from('scanned')]));

    await storage.copy(quarantineKey(id), availableKey(id));
    await storage.delete(quarantineKey(id));

    expect(await contentOf(storage, availableKey(id))).toEqual(Buffer.from('scanned'));
    expect(await storage.head(quarantineKey(id))).toBeNull();
    await storage.delete(quarantineKey(id));
    await storage.delete(availableKey(id));
    expect(await storage.head(availableKey(id))).toBeNull();
  });

  it('lists the objects of a prefix with their dates', async () => {
    const ids = [randomUUID(), randomUUID()];
    for (const id of ids) {
      await storage.put(availableKey(id), Readable.from([Buffer.from(id)]));
    }
    const before = await listAll(storage, QUARANTINE_PREFIX);

    const available = await listAll(storage, AVAILABLE_PREFIX);

    expect(available).toEqual(
      expect.arrayContaining(
        ids.map((id) => ({
          key: `available/${id}`,
          size: id.length,
          lastModified: expect.any(Date) as unknown,
        })),
      ),
    );
    expect(available.every((object) => object.key.startsWith(AVAILABLE_PREFIX))).toBe(true);
    expect(before.every((object) => object.key.startsWith(QUARANTINE_PREFIX))).toBe(true);
  });

  it('throws the error of a failing body and stores nothing', async () => {
    const id = randomUUID();
    const failure = new Error('File too large');
    let pushed = 0;
    // Fails after the first part of 5 MB is sent.
    const body = new Readable({
      read() {
        if (pushed >= 6 * 1024 * 1024) {
          this.destroy(failure);
          return;
        }
        pushed += 1024 * 1024;
        this.push(randomBytes(1024 * 1024));
      },
    });

    await expect(storage.put(quarantineKey(id), body)).rejects.toBe(failure);
    expect(await storage.head(quarantineKey(id))).toBeNull();
  });

  it('throws server.unavailable when the storage cannot be reached', async () => {
    const { app, storage: unreachable } = await startStorage({ TRYBUN_S3_URL: CLOSED_PORT_URL });
    apps.push(app);
    const unavailable = expect.objectContaining({ code: 'server.unavailable' }) as unknown;

    expect(await unreachable.ensureBucket()).toBe(false);
    expect(await unreachable.isAvailable(AbortSignal.timeout(2_000))).toBe(false);
    await expect(unreachable.get(availableKey(randomUUID()))).rejects.toBeInstanceOf(AppError);
    await expect(unreachable.get(availableKey(randomUUID()))).rejects.toEqual(unavailable);
    await expect(
      unreachable.put(quarantineKey(randomUUID()), Readable.from([Buffer.from('x')])),
    ).rejects.toEqual(unavailable);
    await expect(listAll(unreachable, AVAILABLE_PREFIX)).rejects.toEqual(unavailable);
  });
});
