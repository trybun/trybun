import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, type Job, type Queue } from 'bullmq';
import { z } from 'zod';
import { Clock } from '../../platform/clock/clock.js';
import { LogContext } from '../../platform/logging/log-context.js';
import { timerJobOptions } from '../../platform/queues/job-options.js';
import { projectMemberRemovedPayloadSchema } from '../projects/projects.events.js';
import { userEventPayloadSchema } from '../users/users.events.js';
import { TicketUnassignmentService } from './ticket-unassignment.service.js';
import { ticketStatusChangedPayloadSchema } from './tickets.events.js';
import {
  CLOSE_UNCONFIRMED_RESOLUTION_QUEUE,
  resolutionConfirmationTimerKey,
  SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_QUEUE,
  UNASSIGN_DEACTIVATED_USER_QUEUE,
  UNASSIGN_REMOVED_MEMBER_QUEUE,
} from './tickets.jobs.js';
import { TicketsService } from './tickets.service.js';

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

/** The job data of `ticket.status_changed` (§18.3). */
export const scheduleResolutionConfirmationCloseJobSchema = z.object({
  payload: ticketStatusChangedPayloadSchema,
});

/** The job data of the timer (§17.2): the ticket only; the handler reads its current state. */
export const closeUnconfirmedResolutionJobSchema = z.object({ ticketId: z.uuid() });

/** How long the timer waits before it checks a ticket of an archived project again (Q19). */
export const ARCHIVED_PROJECT_RECHECK_MS = 24 * 60 * 60 * 1000;

/**
 * Schedules the automatic close when a ticket starts waiting for the confirmation of its
 * resolution (§4.3): the timer runs 7 × 24 hours after the wait started. It reads the current
 * state, so a late or repeated delivery schedules the same time, and a ticket that no longer waits
 * gets no timer.
 */
@Processor(SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_QUEUE)
export class ScheduleResolutionConfirmationCloseProcessor extends WorkerHost {
  constructor(
    private readonly tickets: TicketsService,
    private readonly clock: Clock,
    @InjectQueue(CLOSE_UNCONFIRMED_RESOLUTION_QUEUE) private readonly timers: Queue,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    await this.logContext.runJob(job, async () => {
      const { payload } = scheduleResolutionConfirmationCloseJobSchema.parse(job.data);
      if (payload.waitingReason !== 'confirmation') {
        return;
      }
      const dueAt = await this.tickets.automaticCloseDueAt(payload.ticketId);
      if (dueAt === null) {
        return;
      }
      const delay = Math.max(0, dueAt.getTime() - this.clock.now().getTime());
      await this.timers.add(
        CLOSE_UNCONFIRMED_RESOLUTION_QUEUE,
        { ticketId: payload.ticketId },
        timerJobOptions(resolutionConfirmationTimerKey(payload.ticketId), delay),
      );
    });
  }
}

/**
 * Closes a ticket whose requester did not answer within 7 days (§4.3), with an automatic event.
 * In an archived project it moves itself back to the delayed state for 24 hours – the same job,
 * no new key – so the ticket closes on the first run after unarchiving (Q19).
 */
@Processor(CLOSE_UNCONFIRMED_RESOLUTION_QUEUE)
export class CloseUnconfirmedResolutionProcessor extends WorkerHost {
  constructor(
    private readonly tickets: TicketsService,
    private readonly clock: Clock,
    private readonly logContext: LogContext,
  ) {
    super();
  }

  async process(job: Job, token?: string): Promise<void> {
    const outcome = await this.logContext.runJob(job, () => {
      const { ticketId } = closeUnconfirmedResolutionJobSchema.parse(job.data);
      return this.tickets.closeUnconfirmedResolution(ticketId);
    });
    if (outcome === 'archived') {
      await job.moveToDelayed(this.clock.now().getTime() + ARCHIVED_PROJECT_RECHECK_MS, token);
      throw new DelayedError();
    }
  }
}
