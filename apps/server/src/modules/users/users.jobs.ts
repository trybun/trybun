import type { OutboxSubscription } from '../../platform/outbox/outbox.jobs.js';
import { USER_DEACTIVATED, USER_REACTIVATED } from './users.events.js';

/**
 * Queue of the job that applies the state of an account to its Keycloak user (§7.4): disabled
 * with its sessions ended while deactivated, enabled otherwise.
 */
export const USERS_KEYCLOAK_QUEUE = 'users-keycloak';

/** The consumer of the account events that synchronizes the Keycloak user (§18.3). */
export const USERS_KEYCLOAK_SUBSCRIPTION: OutboxSubscription = {
  queue: USERS_KEYCLOAK_QUEUE,
  eventTypes: [USER_DEACTIVATED, USER_REACTIVATED],
};
