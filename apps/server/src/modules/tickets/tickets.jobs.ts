import type { OutboxSubscription } from '../../platform/outbox/outbox.jobs.js';
import { PROJECT_MEMBER_REMOVED } from '../projects/projects.events.js';
import { USER_DEACTIVATED } from '../users/users.events.js';

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
