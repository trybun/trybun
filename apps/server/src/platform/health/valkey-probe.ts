import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';

/**
 * Checks Valkey for the readiness of the API (§17.2). Its own connection fails fast instead of
 * queueing commands while Valkey is down, and reconnects in the background.
 */
@Injectable()
export class ValkeyProbe implements OnModuleDestroy {
  private readonly client: Redis;

  constructor(@Inject(TRYBUN_CONFIG) config: TrybunConfig) {
    this.client = new Redis(config.valkeyUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 0,
      connectTimeout: 1_000,
    });
    // An outage is reported by `isAvailable`; the connection errors themselves are expected.
    this.client.on('error', () => undefined);
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (this.client.status === 'wait') {
        await this.client.connect();
      }
      return (await this.client.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
