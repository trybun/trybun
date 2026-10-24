import { describe, expect, it } from 'vitest';
import { isTimeZone } from './index.js';

describe('isTimeZone', () => {
  it.each([
    ['Europe/Warsaw', true],
    ['UTC', true],
    ['America/New_York', true],
    ['Europe/Nowhere', false],
    ['', false],
  ])('%s → %s', (value, expected) => {
    expect(isTimeZone(value)).toBe(expected);
  });
});
