import { describe, expect, it } from 'vitest';
import { isCurrent, navigationItemsFor } from './navigation.js';

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

describe('navigationItemsFor', () => {
  it.each([
    [['open_administration'] as const, 'wide', ['/', '/projects', '/admin']],
    [['open_administration'] as const, 'phone', ['/', '/projects']],
    [[] as const, 'wide', ['/', '/projects']],
  ] as const)('with %j on %s shows %j', (allowedActions, device, hrefs) => {
    expect(navigationItemsFor(allowedActions, device).map((item) => item.href)).toEqual(hrefs);
  });
});
