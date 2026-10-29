import { describe, expect, it } from 'vitest';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { ADMINISTRATION, administrationAbilities } from './administration.abilities.js';

const abilities = new AbilityFactory([administrationAbilities], []);

function principal(overrides: Partial<UserPrincipal>): UserPrincipal {
  return { kind: 'user', userId: 'user', userKind: 'team', isAdmin: false, ...overrides };
}

describe('administration abilities', () => {
  it.each([
    ['an Administrator', principal({ isAdmin: true }), true],
    ['a team member without the role', principal({}), false],
    ['an end user', principal({ userKind: 'end_user' }), false],
  ])('%s may open the Administrator panel: %s', (_case, user, isAllowed) => {
    expect(abilities.forPrincipal(user).can('read', ADMINISTRATION)).toBe(isAllowed);
  });
});
