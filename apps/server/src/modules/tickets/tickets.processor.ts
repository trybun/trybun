import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { z } from 'zod';
import { LogContext } from '../../platform/logging/log-context.js';
import { projectMemberRemovedPayloadSchema } from '../projects/projects.events.js';
import { userEventPayloadSchema } from '../users/users.events.js';
import { TicketUnassignmentService } from './ticket-unassignment.service.js';
import { UNASSIGN_DEACTIVATED_USER_QUEUE, UNASSIGN_REMOVED_MEMBER_QUEUE } from './tickets.jobs.js';

/** The job data of `user.deactivated` (§18.3). */
export const unassignDeactivatedUserJobSchema = z.object({ payload: userEventPayloadSchema });

/** The job data of `project_member.removed` (§18.3). */
export const unassignRemovedMemberJobSchema = z.object({
  payload: projectMemberRemovedPayloadSchema,
});

/** Unassigns the open tickets of a deactivated account (§7.4). */
@Processor(UNASSIGN_DEACTIVATED_USER_QUEUE)
export class UnassignDeactivatedUserProcessor extends WorkerHost {
  constructor(
    private readonly unassignment: TicketUnassignmentService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => {
      const { payload } = unassignDeactivatedUserJobSchema.parse(job.data);
      return this.unassignment.unassignDeactivatedUser(payload.userId);
    });
  }
}

/** Unassigns the open tickets of a member removed from a project (§7.4). */
@Processor(UNASSIGN_REMOVED_MEMBER_QUEUE)
export class UnassignRemovedMemberProcessor extends WorkerHost {
  constructor(
    private readonly unassignment: TicketUnassignmentService,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, () => {
      const { payload } = unassignRemovedMemberJobSchema.parse(job.data);
      return this.unassignment.unassignRemovedMember(payload.projectId, payload.userId);
    });
  }
}
