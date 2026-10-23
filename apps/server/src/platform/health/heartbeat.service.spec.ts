import { mkdtemp, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger, type INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TEST_ENV } from '../../../test/env.js';
import { ConfigModule } from '../config/config.module.js';
import { loadConfig } from '../config/load-config.js';
import { HEARTBEAT_INTERVAL_MS } from './heartbeat.service.js';
import { HeartbeatModule } from './heartbeat.module.js';

async function startWorker(heartbeatFile: string): Promise<INestApplicationContext> {
  const config = loadConfig({
    ...TEST_ENV,
    TRYBUN_WORKER_HEARTBEAT_FILE: heartbeatFile,
  });
  const app = await NestFactory.createApplicationContext(
    { module: class WorkerTestModule {}, imports: [ConfigModule.forRoot(config), HeartbeatModule] },
    { logger: false },
  );
  return app.init();
}

describe('HeartbeatService', () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    dir = await mkdtemp(join(tmpdir(), 'heartbeat-'));
    file = join(dir, 'worker.heartbeat');
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it('writes the heartbeat file at start-up and then every 15 seconds', async () => {
    const app = await startWorker(file);
    expect((await stat(file)).isFile()).toBe(true);

    const old = new Date('2026-01-01T00:00:00Z');
    await utimes(file, old, old);
    vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

    await vi.waitFor(async () => {
      expect((await stat(file)).mtimeMs).toBeGreaterThan(old.getTime());
    });
    await app.close();
  });

  it('stops beating on shutdown', async () => {
    const app = await startWorker(file);
    await app.close();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps the Worker running when the file cannot be written', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    const app = await startWorker(join(dir, 'missing', 'worker.heartbeat'));

    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/^Heartbeat not written/));
    await app.close();
  });
});
