import type { OutboxSubscription } from '../../platform/outbox/outbox.jobs.js';
import { PROJECT_MEMBER_REMOVED } from '../projects/projects.events.js';
import { USER_DEACTIVATED } from '../users/users.events.js';
import { TICKET_STATUS_CHANGED } from './tickets.events.js';
import { jobKey } from '../../platform/queues/job-options.js';

/** Queue of the job that unassigns the open tickets of a deactivated account (§7.4). */
export const UNASSIGN_DEACTIVATED_USER_QUEUE = 'unassign-deactivated-user';

/** Queue of the job that unassigns the open tickets of a member removed from a project (§7.4). */
export const UNASSIGN_REMOVED_MEMBER_QUEUE = 'unassign-removed-member';

/** The consumer of deactivations that unassigns the person's open tickets in every project. */
export const UNASSIGN_DEACTIVATED_USER_SUBSCRIPTION: OutboxSubscription = {
  queue: UNASSIGN_DEACTIVATED_USER_QUEUE,
  eventTypes: [USER_DEACTIVATED],
};

/** The consumer of removals from a project that unassigns the person's open tickets in it. */
export const UNASSIGN_REMOVED_MEMBER_SUBSCRIPTION: OutboxSubscription = {
  queue: UNASSIGN_REMOVED_MEMBER_QUEUE,
  eventTypes: [PROJECT_MEMBER_REMOVED],
};

/**
 * Queue of the consumer of status changes that schedules the automatic close of a ticket waiting
 * for the confirmation of its resolution (§4.3).
 */
export const SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_QUEUE =
  'schedule-resolution-confirmation-close';

/** Queue and job name of the timer that closes an unconfirmed resolution after 7 days (§4.3). */
export const CLOSE_UNCONFIRMED_RESOLUTION_QUEUE = 'close-unconfirmed-resolution';

/** The consumer of status changes that schedules the automatic close. */
export const SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_SUBSCRIPTION: OutboxSubscription = {
  queue: SCHEDULE_RESOLUTION_CONFIRMATION_CLOSE_QUEUE,
  eventTypes: [TICKET_STATUS_CHANGED],
};

/**
 * The deduplication key of the timer of a ticket (§17.1): scheduling it again – a new request for
 * confirmation – replaces the pending timer and restarts its delay.
 */
export function resolutionConfirmationTimerKey(ticketId: string): string {
  return jobKey('resolution-confirmation', ticketId);
}
