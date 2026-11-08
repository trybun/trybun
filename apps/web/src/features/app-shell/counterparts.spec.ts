import { describe, expect, it } from 'vitest';
import { counterpartOf } from './counterparts.js';

describe('counterpartOf', () => {
  // Every route of the counterparts table, for both account kinds (Q1, Q17, Q18).
  it.each([
    ['/', '/portal'],
    ['/projects/0198-a', '/portal/projects/0198-a'],
    ['/projects/0198-a/settings', '/portal'],
    ['/projects', '/portal'],
    ['/tickets/ERP-12', '/portal/tickets/ERP-12'],
    // The full ticket form of S1-10 has no portal counterpart.
    ['/tickets/new', '/portal'],
    ['/tickets/new?projectId=0198-a', '/portal'],
    ['/settings', '/portal/settings'],
    ['/settings?tab=x', '/portal/settings'],
    ['/admin/accounts', '/portal'],
    ['/help', '/portal'],
  ])('an end user opening %s goes to %s', (path, expected) => {
    expect(counterpartOf(path, 'portal')).toBe(expected);
  });

  it.each([
    ['/portal', '/'],
    ['/portal/projects/0198-a', '/projects/0198-a'],
    ['/portal/projects/0198-a/tickets/new', '/'],
    // The team ticket view of S1-10 (its Q8).
    ['/portal/tickets/ERP-12', '/tickets/ERP-12'],
    ['/portal/tickets', '/'],
    ['/portal/tickets?projectId=0198-a', '/'],
    ['/portal/tickets/ERP-12/resolution-confirmation?answer=solved', '/'],
    ['/portal/settings', '/settings'],
  ])('a team member opening %s goes to %s', (path, expected) => {
    expect(counterpartOf(path, 'team')).toBe(expected);
  });
});
