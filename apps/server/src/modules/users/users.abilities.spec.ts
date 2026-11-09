// The rows of §7.5 about accounts (§18.3): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import type { UserAction } from '@trybun/contracts/users';
import { describe, expect, it } from 'vitest';
import {
  buildPrincipal,
  PRINCIPAL_ID,
  type PrincipalFixture,
} from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { USER, usersAbilities } from './users.abilities.js';
import { FixedClock } from '../../../test/fixed-clock.js';

const abilities = new AbilityFactory([usersAbilities], [], new FixedClock());

const OTHER_ID = '0190f2f4-7c1e-7000-8000-000000000002';

type Who = Extract<PrincipalFixture, 'admin' | 'team_member' | 'end_user'>;

/** The account actions of S1-20, whose codes join the contract with their endpoints (Q11). */
type AccountChange = 'change_kind' | 'change_email';

interface Account {
  id: string;
  kind: 'team' | 'end_user';
  state: 'invited' | 'active' | 'deactivated' | 'anonymized';
  isAdmin: boolean;
}

function account(overrides: Partial<Account> = {}) {
  return subject(USER, {
    id: OTHER_ID,
    kind: 'team',
    state: 'active',
    isAdmin: false,
    ...overrides,
  });
}

function can(
  who: Who,
  action: UserAction | AccountChange | 'read',
  overrides: Partial<Account> = {},
) {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, account(overrides));
}

describe('account abilities', () => {
  it.each([
    ['View the list of accounts', 'admin', true],
    ['View the list of accounts', 'team_member', false],
    ['View the list of accounts', 'end_user', false],
  ] as const)('%s – %s: %s', (_row, who, isAllowed) => {
    expect(can(who, 'read')).toBe(isAllowed);
  });

  it.each([
    ['Deactivate and reactivate accounts', 'deactivate', 'admin', {}, true],
    ['Deactivate and reactivate accounts', 'deactivate', 'admin', { state: 'invited' }, true],
    ['Deactivate and reactivate accounts', 'deactivate', 'admin', { state: 'deactivated' }, false],
    ['Deactivate and reactivate accounts', 'deactivate', 'admin', { state: 'anonymized' }, false],
    ['Deactivate and reactivate accounts', 'deactivate', 'admin', { id: PRINCIPAL_ID }, false],
    ['Deactivate and reactivate accounts', 'deactivate', 'team_member', {}, false],
    ['Deactivate and reactivate accounts', 'reactivate', 'admin', { state: 'deactivated' }, true],
    ['Deactivate and reactivate accounts', 'reactivate', 'admin', {}, false],
    [
      'Deactivate and reactivate accounts',
      'reactivate',
      'end_user',
      { state: 'deactivated' },
      false,
    ],
    ['Grant or revoke the Administrator role', 'grant_admin', 'admin', {}, true],
    ['Grant or revoke the Administrator role', 'grant_admin', 'admin', { isAdmin: true }, false],
    ['Grant or revoke the Administrator role', 'grant_admin', 'admin', { kind: 'end_user' }, false],
    ['Grant or revoke the Administrator role', 'grant_admin', 'admin', { state: 'invited' }, false],
    [
      'Grant or revoke the Administrator role',
      'grant_admin',
      'admin',
      { state: 'deactivated' },
      false,
    ],
    ['Grant or revoke the Administrator role', 'grant_admin', 'team_member', {}, false],
    ['Grant or revoke the Administrator role', 'revoke_admin', 'admin', { isAdmin: true }, true],
    [
      'Grant or revoke the Administrator role',
      'revoke_admin',
      'admin',
      { isAdmin: true, state: 'deactivated' },
      true,
    ],
    ['Grant or revoke the Administrator role', 'revoke_admin', 'admin', {}, false],
    [
      'Grant or revoke the Administrator role',
      'revoke_admin',
      'admin',
      { isAdmin: true, id: PRINCIPAL_ID },
      false,
    ],
    [
      'Grant or revoke the Administrator role',
      'revoke_admin',
      'team_member',
      { isAdmin: true },
      false,
    ],
    ['Change account kind or e-mail address', 'change_kind', 'admin', {}, true],
    ['Change account kind or e-mail address', 'change_kind', 'admin', { state: 'invited' }, true],
    [
      'Change account kind or e-mail address',
      'change_kind',
      'admin',
      { state: 'deactivated' },
      true,
    ],
    [
      'Change account kind or e-mail address',
      'change_kind',
      'admin',
      { state: 'anonymized' },
      false,
    ],
    ['Change account kind or e-mail address', 'change_kind', 'admin', { id: PRINCIPAL_ID }, false],
    ['Change account kind or e-mail address', 'change_kind', 'team_member', {}, false],
    ['Change account kind or e-mail address', 'change_email', 'admin', {}, true],
    ['Change account kind or e-mail address', 'change_email', 'admin', { kind: 'end_user' }, true],
    ['Change account kind or e-mail address', 'change_email', 'admin', { id: PRINCIPAL_ID }, true],
    [
      'Change account kind or e-mail address',
      'change_email',
      'admin',
      { state: 'anonymized' },
      false,
    ],
    ['Change account kind or e-mail address', 'change_email', 'end_user', {}, false],
  ] as const)('%s (%s) – %s on %o: %s', (_row, action, who, overrides, isAllowed) => {
    expect(can(who, action, overrides)).toBe(isAllowed);
  });
});
