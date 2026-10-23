import type { DefaultJobOptions, JobsOptions } from 'bullmq';

const HOUR_IN_SECONDS = 60 * 60;

/**
 * Options of every job (§17.2): retries with exponential backoff (10 attempts over about 85
 * minutes), completed jobs removed after 24 hours, failed jobs kept for 30 days.
 */
export const DEFAULT_JOB_OPTIONS = {
  attempts: 10,
  backoff: { type: 'exponential', delay: 10_000 },
  removeOnComplete: { age: 24 * HOUR_IN_SECONDS },
  removeOnFail: { age: 30 * 24 * HOUR_IN_SECONDS },
} as const satisfies DefaultJobOptions;

/**
 * A custom job ID or deduplication key `<job-name>-<id>[-<id>]` (§17.1). BullMQ reserves `:` and
 * refuses IDs of digits only.
 */
export function jobKey(jobName: string, ...ids: string[]): string {
  const key = [jobName, ...ids].join('-');
  if (key.includes(':') || /^\d+$/.test(key)) {
    throw new Error(`Invalid job key "${key}": no ":" and not digits only (§17.1)`);
  }
  return key;
}

/**
 * A timer (§17.2): a delayed job deduplicated by its key in debounce mode, so scheduling it again
 * replaces the pending job and restarts the delay instead of adding a second job.
 */
export function timerJobOptions(key: string, delayMs: number): JobsOptions {
  return { delay: delayMs, deduplication: { id: key, ttl: delayMs, extend: true, replace: true } };
}
