// The adapter of the malware scanner against clamd of the pinned ClamAV image with the clamd
// configuration of the deployment package (ADR 0008, attachment serving item 2).
import { Readable } from 'node:stream';
import type { INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startClamav, type TestClamav } from '../../../test/clamav/clamav.js';
import { TEST_ENV } from '../../../test/env.js';
import { zipArchive } from '../../../test/files/zip.js';
import { ConfigModule } from '../config/config.module.js';
import { loadConfig } from '../config/load-config.js';
import { AppError } from '../errors/app-error.js';
import { LoggingModule } from '../logging/logging.module.js';
import { ClamavModule } from './clamav.module.js';
import { MALWARE_SCANNER, type MalwareScanner } from './malware-scanner.js';

/** The EICAR test file, encoded so that no scanner flags this source file. */
const EICAR = Buffer.from(
  'WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=',
  'base64',
);

const MB = 1024 * 1024;

/** An address where nothing listens. */
const CLOSED_PORT_URL = 'tcp://127.0.0.1:1';

async function startScanner(
  clamavUrl: string,
): Promise<{ app: INestApplicationContext; scanner: MalwareScanner }> {
  const app = await NestFactory.createApplicationContext(
    {
      module: class ClamavTestModule {},
      imports: [
        ConfigModule.forRoot(loadConfig({ ...TEST_ENV, TRYBUN_CLAMAV_URL: clamavUrl })),
        LoggingModule.forRoot(),
        ClamavModule,
      ],
    },
    { logger: false, abortOnError: false },
  );
  await app.init();
  return { app, scanner: app.get<MalwareScanner>(MALWARE_SCANNER) };
}

/** `size` zero bytes in chunks of 1 MB, never held in memory at once. */
function zeros(size: number): Readable {
  let left = size;
  return new Readable({
    read() {
      const chunk = Math.min(left, MB);
      left -= chunk;
      this.push(chunk === 0 ? null : Buffer.alloc(chunk));
    },
  });
}

describe('ClamdScanner', () => {
  const apps: INestApplicationContext[] = [];
  let clamav: TestClamav;
  let scanner: MalwareScanner;

  beforeAll(async () => {
    clamav = await startClamav();
    const started = await startScanner(clamav.url);
    apps.push(started.app);
    scanner = started.scanner;
  }, 300_000);

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
    await clamav.container.stop();
  });

  it('answers PING', async () => {
    expect(await scanner.ping()).toBe(true);
  });

  it('reports a clean file as clean', async () => {
    const result = await scanner.scan(Readable.from([Buffer.from('A plain text attachment.\n')]));

    expect(result).toEqual({ verdict: 'clean' });
  });

  it('reports the EICAR test file as infected with its signature', async () => {
    const result = await scanner.scan(Readable.from([EICAR]));

    expect(result).toEqual({ verdict: 'infected', signature: 'Eicar-Test-Signature' });
  });

  // clamd unpacks up to MaxScanSize (400 MB) before it reports the archive.
  it('reports a ZIP whose entry exceeds MaxFileSize and MaxScanSize as not completely scannable', async () => {
    // About 400 KB that unpack to 402 MB.
    const archive = zipArchive([
      { name: 'zeros.bin', content: Buffer.alloc(402 * MB), isDeflated: true },
    ]);

    const result = await scanner.scan(Readable.from([archive]));

    expect(result).toEqual({
      verdict: 'unscannable',
      signature: expect.stringMatching(/^Heuristics\.Limits\.Exceeded\./) as unknown,
    });
  }, 120_000);

  it('reports an encrypted ZIP as not completely scannable', async () => {
    const archive = zipArchive([
      { name: 'secret.txt', content: Buffer.from('encrypted'), isEncrypted: true },
    ]);

    const result = await scanner.scan(Readable.from([archive]));

    expect(result).toEqual({
      verdict: 'unscannable',
      signature: expect.stringMatching(/^Heuristics\.Encrypted\./) as unknown,
    });
  });

  it('fails for a stream above StreamMaxLength, which clamd refuses', async () => {
    const content = zeros(102 * MB);

    await expect(scanner.scan(content)).rejects.toThrow(new AppError('server.unavailable'));
    expect(content.destroyed).toBe(true);
  }, 60_000);

  it('fails when clamd cannot be reached, and PING reports it', async () => {
    const { app, scanner: unreachable } = await startScanner(CLOSED_PORT_URL);
    apps.push(app);

    expect(await unreachable.ping()).toBe(false);
    await expect(unreachable.scan(Readable.from([EICAR]))).rejects.toMatchObject({
      code: 'server.unavailable',
    });
  });
});
