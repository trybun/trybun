import { type ExtractSubjectType, type Generics, type Normalize, subject } from '@casl/ability';
import { accessibleBy } from '@casl/prisma/runtime';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { buildPrincipal } from '../../../test/factories/principal.factory.js';
import { FixedClock } from '../../../test/fixed-clock.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AbilityFactory, type AppAbility, type UserRuleRecord } from './ability-factory.js';

type AppSubjectType = ExtractSubjectType<
  Normalize<Generics<AppAbility>['abilities']>[1],
  Generics<AppAbility>['subjectResolver']
>;

const ability = new AbilityFactory(
  [
    ({ can }) => {
      can('read', 'User', { kind: 'team' });
    },
  ],
  [],
  new FixedClock(),
).forPrincipal(buildPrincipal('admin'));

const user: UserRuleRecord = { id: 'user-1', kind: 'team', state: 'active', isAdmin: false };

describe('AbilityFactory', () => {
  // A `kind` field of a rule record is a field like any other, never the subject tag (#273).
  it('resolves the subject types from the subject tag, not from a `kind` field', () => {
    expectTypeOf<AppSubjectType>().toEqualTypeOf<
      | 'Project'
      | 'Organization'
      | 'Invitation'
      | 'User'
      | 'Ticket'
      | 'Attachment'
      | 'Comment'
      | 'Administration'
    >();
    expectTypeOf(
      accessibleBy(ability, 'read').ofType('User'),
    ).toEqualTypeOf<Prisma.UserWhereInput>();
  });

  it('checks a record with a `kind` field by the conditions on that field', () => {
    expect(ability.can('read', subject('User', user))).toBe(true);
    expect(ability.can('read', subject('User', { ...user, kind: 'end_user' }))).toBe(false);
    expect(accessibleBy(ability, 'read').ofType('User')).toEqual({ OR: [{ kind: 'team' }] });
  });
});
