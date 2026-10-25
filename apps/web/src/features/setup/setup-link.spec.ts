import { describe, expect, it } from 'vitest';
import { setupTokenOf, timeZones } from './setup-link.js';

describe('setupTokenOf', () => {
  it.each([
    ['#token=abc-_1', 'abc-_1'],
    ['', ''],
    ['#other=1', ''],
  ])('reads the token of %j', (hash, token) => {
    expect(setupTokenOf(hash)).toBe(token);
  });
});

describe('timeZones', () => {
  it('lists UTC and the IANA zones', () => {
    expect(timeZones()).toEqual(expect.arrayContaining(['UTC', 'Europe/Warsaw']));
  });
});
