import { setTimeout as sleep } from 'node:timers/promises';
import { type Job, Queue, Worker } from 'bullmq';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { jobKey, timerJobOptions } from './job-options.js';

const QUEUE = 'timers-test';
const DELAY_MS = 1_000;

describe('timers', () => {
  let queue: Queue;
  let worker: Worker;
  const runs: { data: unknown; at: number }[] = [];

  beforeAll(() => {
    const connection = { url: inject('valkeyUrl') };
    queue = new Queue(QUEUE, { connection });
    worker = new Worker(
      QUEUE,
      (job: Job) => {
        runs.push({ data: job.data, at: Date.now() });
        return Promise.resolve();
      },
      { connection },
    );
  });

  afterAll(async () => {
    await worker.close();
    await queue.close();
  });

  it('runs a timer rescheduled twice once, at the last scheduled time', async () => {
    const key = jobKey('test-timer', 'ticket-1');

    await queue.add('test-timer', { version: 1 }, timerJobOptions(key, DELAY_MS));
    await sleep(300);
    await queue.add('test-timer', { version: 2 }, timerJobOptions(key, DELAY_MS));
    await sleep(300);
    const lastScheduledAt = Date.now();
    await queue.add('test-timer', { version: 3 }, timerJobOptions(key, DELAY_MS));

    await expect.poll(() => runs.length, { timeout: 5_000 }).toBe(1);
    // Nothing else fires after the first run would have been due.
    await sleep(DELAY_MS);
    expect(runs).toHaveLength(1);
    expect(runs[0]?.data).toEqual({ version: 3 });
    expect(runs[0]?.at).toBeGreaterThanOrEqual(lastScheduledAt + DELAY_MS);
  });
});
