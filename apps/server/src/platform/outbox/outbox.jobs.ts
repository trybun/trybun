/** Queue of the outbox's own recurring work (§17.1). */
export const OUTBOX_QUEUE = 'outbox';

/** Recurring job deleting published events after 7 days (§17.2); also its scheduler ID. */
export const OUTBOX_PURGE_JOB = 'outbox-purge';

/**
 * A consumer of outbox events: the queue its processor consumes and the event types it handles.
 * Every consumer has its own queue, so a retry of one consumer never repeats another (§18.3).
 */
export interface OutboxSubscription {
  queue: string;
  eventTypes: readonly string[];
}

/**
 * The data of the job of an outbox event: the event's payload and the request ID of the API call
 * that caused it, which the processor runs with (`LogContext.runJob`, §17.2).
 */
export interface OutboxEventJobData {
  payload: Record<string, unknown>;
  requestId: string | null;
}
