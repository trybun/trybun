import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import { LogContext } from '../../platform/logging/log-context.js';
import { userEventPayloadSchema } from './users.events.js';
import { USERS_KEYCLOAK_QUEUE } from './users.jobs.js';
import { UsersKeycloakService } from './users-keycloak.service.js';

/** The job data of `user.deactivated` and `user.reactivated` (§18.3). */
export const usersKeycloakJobSchema = z.object({ payload: userEventPayloadSchema });

/** Applies the state of an account to its Keycloak user after a deactivation or reactivation. */
@Processor(USERS_KEYCLOAK_QUEUE)
export class UsersKeycloakProcessor extends WorkerHost {
  constructor(
    private readonly usersKeycloak: UsersKeycloakService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => {
      const { payload } = usersKeycloakJobSchema.parse(job.data);
      return this.usersKeycloak.synchronize(payload.userId);
    });
  }
}
