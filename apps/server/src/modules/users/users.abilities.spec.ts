// The rows of §7.5 about accounts (§18.3): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import type { UserAction } from '@trybun/contracts/users';
import { describe, expect, it } from 'vitest';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { USER, usersAbilities } from './users.abilities.js';

const abilities = new AbilityFactory([usersAbilities], []);

const PRINCIPAL_ID = '0190f2f4-7c1e-7000-8000-000000000001';
const OTHER_ID = '0190f2f4-7c1e-7000-8000-000000000002';

type Who = 'admin' | 'team_member' | 'end_user';

function principal(who: Who): UserPrincipal {
  return {
    kind: 'user',
    userId: PRINCIPAL_ID,
    userKind: who === 'end_user' ? 'end_user' : 'team',
    isAdmin: who === 'admin',
  };
}

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

function can(who: Who, action: UserAction | 'read', overrides: Partial<Account> = {}) {
  return abilities.forPrincipal(principal(who)).can(action, account(overrides));
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
    ['deactivate', 'admin', {}, true],
    ['deactivate', 'admin', { state: 'invited' }, true],
    ['deactivate', 'admin', { state: 'deactivated' }, false],
    ['deactivate', 'admin', { state: 'anonymized' }, false],
    ['deactivate', 'admin', { id: PRINCIPAL_ID }, false],
    ['deactivate', 'team_member', {}, false],
    ['reactivate', 'admin', { state: 'deactivated' }, true],
    ['reactivate', 'admin', {}, false],
    ['reactivate', 'end_user', { state: 'deactivated' }, false],
    ['grant_admin', 'admin', {}, true],
    ['grant_admin', 'admin', { isAdmin: true }, false],
    ['grant_admin', 'admin', { kind: 'end_user' }, false],
    ['grant_admin', 'admin', { state: 'invited' }, false],
    ['grant_admin', 'admin', { state: 'deactivated' }, false],
    ['grant_admin', 'team_member', {}, false],
    ['revoke_admin', 'admin', { isAdmin: true }, true],
    ['revoke_admin', 'admin', { isAdmin: true, state: 'deactivated' }, true],
    ['revoke_admin', 'admin', {}, false],
    ['revoke_admin', 'admin', { isAdmin: true, id: PRINCIPAL_ID }, false],
    ['revoke_admin', 'team_member', { isAdmin: true }, false],
  ] as const)('%s – %s on %o: %s', (action, who, overrides, isAllowed) => {
    expect(can(who, action, overrides)).toBe(isAllowed);
  });
});
