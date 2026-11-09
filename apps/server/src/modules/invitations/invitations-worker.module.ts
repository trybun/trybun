import { BullModule, InjectQueue } from '@nestjs/bullmq';
import { Module, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { INVITATIONS_QUEUE, KEYCLOAK_USER_CLEANUP_JOB } from './invitations.jobs.js';
import { InvitationsProcessor } from './invitations.processor.js';
import { KeycloakUserCleanupService } from './keycloak-user-cleanup.service.js';

const KEYCLOAK_USER_CLEANUP_INTERVAL_MS = 60 * 60 * 1_000;

/** The recurring work of invitations (AQ2), imported only by the Worker. */
@Module({
  imports: [BullModule.registerQueue({ name: INVITATIONS_QUEUE })],
  providers: [InvitationsProcessor, KeycloakUserCleanupService],
})
export class InvitationsWorkerModule implements OnApplicationBootstrap {
  constructor(@InjectQueue(INVITATIONS_QUEUE) private readonly queue: Queue) {}

  /** One run per interval regardless of the number of Worker replicas (§17.2). */
  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(
      KEYCLOAK_USER_CLEANUP_JOB,
      { every: KEYCLOAK_USER_CLEANUP_INTERVAL_MS },
      { name: KEYCLOAK_USER_CLEANUP_JOB },
    );
  }
}
