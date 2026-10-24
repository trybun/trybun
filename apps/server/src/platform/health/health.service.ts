import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../database/prisma.service.js';
import { AppError } from '../errors/app-error.js';
import { selectOne } from './health.sql.js';
import { ValkeyProbe } from './valkey-probe.js';

/** A dependency the API keeps working without, with reduced functionality (§17.2). */
export type OptionalDependencyStatus = 'ok' | 'degraded';

export interface Readiness {
  status: OptionalDependencyStatus;
  database: 'ok';
  valkey: OptionalDependencyStatus;
}

/** A check that does not answer in this time counts as failed. */
const CHECK_TIMEOUT_MS = 2_000;

function withTimeout<T>(check: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    check,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), CHECK_TIMEOUT_MS).unref()),
  ]);
}

/**
 * Readiness of the API (§17.2): it fails only when PostgreSQL is unavailable; Valkey is reported
 * as `degraded` without failing. Object storage joins with its adapter (S1-08).
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly valkey: ValkeyProbe,
    @InjectPinoLogger(HealthService.name) private readonly logger: PinoLogger,
  ) {}

  async readiness(): Promise<Readiness> {
    const [isDatabaseAvailable, isValkeyAvailable] = await Promise.all([
      withTimeout(
        selectOne(this.prisma).then(
          () => true,
          () => false,
        ),
        false,
      ),
      withTimeout(this.valkey.isAvailable(), false),
    ]);
    if (!isDatabaseAvailable) {
      this.logger.error({ dependency: 'postgresql' }, 'Dependency unavailable');
      throw new AppError('server.unavailable');
    }
    if (!isValkeyAvailable) {
      this.logger.warn({ dependency: 'valkey' }, 'Dependency unavailable');
    }
    const valkeyStatus = isValkeyAvailable ? 'ok' : 'degraded';
    return { status: valkeyStatus, database: 'ok', valkey: valkeyStatus };
  }
}
