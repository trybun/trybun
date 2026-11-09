import { Clock } from '../src/platform/clock/clock.js';

/** A clock that always returns the same time (§18.7): tests decide the time. */
export class FixedClock extends Clock {
  constructor(private readonly time: Date = new Date('2026-11-09T10:00:00.000Z')) {
    super();
  }

  now(): Date {
    return this.time;
  }
}
