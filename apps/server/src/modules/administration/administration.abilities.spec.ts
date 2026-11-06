import { describe, expect, it } from 'vitest';
import { buildPrincipal } from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { ADMINISTRATION, administrationAbilities } from './administration.abilities.js';

const abilities = new AbilityFactory([administrationAbilities], []);

describe('administration abilities', () => {
  it.each([
    ['an Administrator', buildPrincipal('admin'), true],
    ['a Project manager', buildPrincipal('project_manager'), false],
    ['an end user', buildPrincipal('end_user_organization'), false],
    [
      'an end user with the Administrator flag',
      { ...buildPrincipal('end_user'), isAdmin: true },
      false,
    ],
  ])('%s may open the Administrator panel: %s', (_case, user, isAllowed) => {
    expect(abilities.forPrincipal(user).can('read', ADMINISTRATION)).toBe(isAllowed);
  });
});
