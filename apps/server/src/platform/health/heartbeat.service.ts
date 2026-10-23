import { writeFile } from 'node:fs/promises';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { TRYBUN_CONFIG } from '../config/config.module.js';
import type { TrybunConfig } from '../config/config.schema.js';

/** The Compose health check fails when the file is older than 60 seconds (§17.2). */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Writes the heartbeat file of the Worker, which has no HTTP server (§14.6, §17.2). The timer
 * also keeps the process alive while no queue is consumed.
 */
@Injectable()
export class HeartbeatService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(HeartbeatService.name);
  private timer: NodeJS.Timeout | undefined;

  constructor(@Inject(TRYBUN_CONFIG) private readonly config: TrybunConfig) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.beat();
    this.timer = setInterval(() => void this.beat(), HEARTBEAT_INTERVAL_MS);
  }

  onApplicationShutdown(): void {
    clearInterval(this.timer);
  }

  private async beat(): Promise<void> {
    try {
      await writeFile(this.config.workerHeartbeatFile, '');
    } catch (error) {
      // A missed beat only shows in the health check; the Worker keeps processing jobs.
      this.logger.warn(`Heartbeat not written: ${String(error)}`);
    }
  }
}
