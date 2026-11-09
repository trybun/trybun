import { describe, expect, it } from 'vitest';
import { isCurrent, isCurrentItem, navigationItemsFor } from './navigation.js';

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
    [['open_administration'] as const, 'wide', ['/', '/tickets', '/projects', '/admin']],
    [['open_administration'] as const, 'phone', ['/', '/tickets', '/projects']],
    [[] as const, 'wide', ['/', '/tickets', '/projects']],
  ] as const)('a team account with %j on %s sees %j', (allowedActions, device, hrefs) => {
    expect(
      navigationItemsFor({ shell: 'team', allowedActions }, device).map((item) => item.href),
    ).toEqual(hrefs);
  });

  it.each([
    [true, 'phone', ['/portal', '/portal/tickets']],
    [true, 'wide', ['/portal', '/portal/tickets']],
    [false, 'phone', ['/portal/tickets']],
    [false, 'wide', ['/portal/tickets']],
  ] as const)(
    'the portal with a choice of projects %s on %s shows %j (§5.7)',
    (hasProjectChoice, device, hrefs) => {
      expect(
        navigationItemsFor({ shell: 'portal', hasProjectChoice }, device).map((item) => item.href),
      ).toEqual(hrefs);
    },
  );
});

describe('isCurrentItem', () => {
  const [projects, myTickets] = navigationItemsFor(
    { shell: 'portal', hasProjectChoice: true },
    'wide',
  );

  it.each([
    ['/portal', true, false],
    ['/portal/projects/0198', true, false],
    ['/portal/projects/0198/tickets/new', true, false],
    ['/portal/tickets', false, true],
    ['/portal/tickets/ERP-12', false, true],
    ['/portal/settings', false, false],
  ])('on %s: Projects %s, My tickets %s', (pathname, isProjects, isMyTickets) => {
    expect(projects && isCurrentItem(projects, pathname)).toBe(isProjects);
    expect(myTickets && isCurrentItem(myTickets, pathname)).toBe(isMyTickets);
  });
});
