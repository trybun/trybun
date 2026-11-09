import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { LogContext } from '../../platform/logging/log-context.js';
import { INVITATIONS_QUEUE } from './invitations.jobs.js';
import { KeycloakUserCleanupService } from './keycloak-user-cleanup.service.js';

/** The recurring deletion of Keycloak users without an account (AQ2). */
@Processor(INVITATIONS_QUEUE)
export class InvitationsProcessor extends WorkerHost {
  constructor(
    private readonly cleanup: KeycloakUserCleanupService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => this.cleanup.deleteUsersWithoutAccount());
  }
}
