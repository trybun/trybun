import type { Readable } from 'node:stream';
import { Inject, Injectable } from '@nestjs/common';
import NodeClam from 'clamscan';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { z } from 'zod';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';
import { AppError } from '../errors/app-error.js';
import type { MalwareScanner, ScanResult } from './malware-scanner.js';

/**
 * A scan that takes longer fails, before clamd's `ReadTimeout` of 120 seconds
 * (docker/clamav/clamd.conf) ends the connection on its side; BullMQ retries it (ADR 0008).
 */
const SCAN_TIMEOUT_MS = 100_000;

/** `PING` answers at once when clamd runs. */
const PING_TIMEOUT_MS = 5_000;

/** Signatures of files clamd could not scan completely (attachment serving item 2). */
const UNSCANNABLE_SIGNATURE = /^Heuristics\.(Limits\.Exceeded|Encrypted)\./;

/** `isInfected` is `null` when clamd's reply is neither `OK` nor `FOUND`, e.g. a timeout. */
const scanResponseSchema = z.object({
  isInfected: z.boolean().nullable(),
  viruses: z.array(z.string()),
});

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`No answer within ${timeoutMs} ms`));
    }, timeoutMs);
  });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

function verdictOf(signature: string): ScanResult {
  return UNSCANNABLE_SIGNATURE.test(signature)
    ? { verdict: 'unscannable', signature }
    : { verdict: 'infected', signature };
}

/** clamd over TCP with the `clamscan` client (§14.2, ADR 0008), at `TRYBUN_CLAMAV_URL`. */
@Injectable()
export class ClamdScanner implements MalwareScanner {
  private client: Promise<NodeClam> | undefined;

  constructor(
    @Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig,
    @InjectPinoLogger(ClamdScanner.name) private readonly logger: PinoLogger,
  ) {}

  async scan(content: Readable): Promise<ScanResult> {
    try {
      const client = await this.connect();
      const response = scanResponseSchema.parse(
        await withTimeout(client.scanStream(content), SCAN_TIMEOUT_MS, () =>
          // Ends the scan in clamscan, which then stops reading the content.
          content.destroy(new Error('Scan timed out')),
        ),
      );
      if (response.isInfected === null) {
        throw new Error('clamd gave no verdict');
      }
      if (!response.isInfected) {
        return { verdict: 'clean' };
      }
      return verdictOf(response.viruses[0] ?? 'unknown');
    } catch (error) {
      content.destroy();
      // The messages of clamscan hold clamd's replies, never content or file names (§13.5).
      this.logger.warn(
        { dependency: 'clamav', error: error instanceof Error ? error.message : 'unknown' },
        'Malware scan failed',
      );
      throw new AppError('server.unavailable');
    }
  }

  async ping(): Promise<boolean> {
    try {
      const client = await this.connect();
      const pinging = client.ping();
      const socket = await withTimeout(pinging, PING_TIMEOUT_MS, () => {
        // A late answer still closes its connection.
        void pinging.then(
          (late) => late.end(),
          () => undefined,
        );
      });
      socket.end();
      return true;
    } catch {
      return false;
    }
  }

  /** One client; it opens a connection per command (`bypassTest`: none at start-up). */
  private connect(): Promise<NodeClam> {
    this.client ??= new NodeClam().init({
      clamdscan: {
        host: this.config.clamav.host,
        port: this.config.clamav.port,
        timeout: SCAN_TIMEOUT_MS,
        localFallback: false,
        bypassTest: true,
      },
      clamscan: { active: false },
      preference: 'clamdscan',
    });
    this.client.catch(() => {
      this.client = undefined;
    });
    return this.client;
  }
}
