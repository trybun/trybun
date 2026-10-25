import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { Redis } from 'ioredis';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';

type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

/**
 * The counters of the rate limits in Valkey (`@nest-lab/throttler-storage-redis`, §14.4), shared
 * by every instance of the API. While Valkey is unavailable the rate limit fails open: requests
 * pass and a warning is logged (§17.2). The connection fails fast instead of queueing commands.
 */
@Injectable()
export class ValkeyThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly client: Redis;
  private readonly storage: ThrottlerStorageRedisService;

  constructor(
    @Inject(TRYBUN_CONFIG) config: TrybunConfig,
    @InjectPinoLogger(ValkeyThrottlerStorage.name) private readonly logger: PinoLogger,
  ) {
    this.client = new Redis(config.valkeyUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 1_000,
    });
    // An outage is logged with each request that passes without a limit.
    this.client.on('error', () => undefined);
    this.storage = new ThrottlerStorageRedisService(this.client);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    try {
      return await this.storage.increment(key, ttl, limit, blockDuration, throttlerName);
    } catch (error) {
      this.logger.warn({ err: error }, 'Rate limit skipped: Valkey is unavailable');
      return {
        totalHits: 0,
        timeToExpire: Math.ceil(ttl / 1_000),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
