import { describe, expect, it } from 'vitest';
import { jobKey, timerJobOptions } from './job-options.js';

describe('jobKey', () => {
  it.each([
    [['notification-batch', 'u1', 't1'], 'notification-batch-u1-t1'],
    [
      ['sla-timer', '0190f2f4-7c1e-7000-8000-000000000001'],
      'sla-timer-0190f2f4-7c1e-7000-8000-000000000001',
    ],
    [['outbox-purge'], 'outbox-purge'],
  ])('joins %j into %s', (parts, key) => {
    const [jobName = '', ...ids] = parts;
    expect(jobKey(jobName, ...ids)).toBe(key);
  });

  it.each([[['sla-timer', 'a:b']], [['42']]])('rejects %j', (parts) => {
    const [jobName = '', ...ids] = parts;
    expect(() => jobKey(jobName, ...ids)).toThrow(/^Invalid job key/);
  });
});

describe('timerJobOptions', () => {
  it('deduplicates in debounce mode for the length of the delay', () => {
    expect(timerJobOptions('sla-timer-t1', 60_000)).toEqual({
      delay: 60_000,
      deduplication: { id: 'sla-timer-t1', ttl: 60_000, extend: true, replace: true },
    });
  });
});
