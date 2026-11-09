// The identities of other customers (§5.4, S1-11 Q9).
import { describe, expect, it } from 'vitest';
import { identityVisibleTo } from './identities.js';

const VIEWER = 'viewer';
const OTHER = 'other';

describe('identityVisibleTo', () => {
  it.each([
    ['a team member sees a customer', 'team', OTHER, 'end_user', false, true],
    ['a customer sees a team member', 'end_user', OTHER, 'team', false, true],
    ['a customer sees themselves', 'end_user', VIEWER, 'end_user', false, true],
    [
      'a customer sees a colleague of their organization',
      'end_user',
      OTHER,
      'end_user',
      true,
      true,
    ],
    [
      'a customer does not see a customer of another organization',
      'end_user',
      OTHER,
      'end_user',
      false,
      false,
    ],
  ] as const)('%s', (_case, viewerKind, personId, personKind, shares, isVisible) => {
    expect(
      identityVisibleTo(
        { id: VIEWER, kind: viewerKind },
        { id: personId, kind: personKind, sharesOrganizationWithViewer: shares },
      ),
    ).toBe(isVisible);
  });
});
