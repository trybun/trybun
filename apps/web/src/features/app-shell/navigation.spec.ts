import { describe, expect, it } from 'vitest';
import { isCurrent } from './navigation.js';

describe('isCurrent', () => {
  it.each([
    ['/', '/', true],
    ['/', '/tickets', false],
    ['/tickets', '/tickets', true],
    ['/tickets', '/tickets/123', true],
    ['/tickets', '/tickets-archive', false],
  ])('%s is current on %s: %s', (href, pathname, expected) => {
    expect(isCurrent(href, pathname)).toBe(expected);
  });
});
