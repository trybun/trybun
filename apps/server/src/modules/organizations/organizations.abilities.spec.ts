// The rows of §7.5 about organizations (§18.3): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import type { OrganizationAction } from '@trybun/contracts/organizations';
import { describe, expect, it } from 'vitest';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedOrganizationsRestriction,
  CREATE,
  ORGANIZATION,
  organizationsAbilities,
} from './organizations.abilities.js';

const abilities = new AbilityFactory([organizationsAbilities], [archivedOrganizationsRestriction]);

type Who = 'admin' | 'team_member' | 'end_user';

function principal(who: Who): UserPrincipal {
  return {
    kind: 'user',
    userId: '0190f2f4-7c1e-7000-8000-000000000001',
    userKind: who === 'end_user' ? 'end_user' : 'team',
    isAdmin: who === 'admin',
  };
}

function organization(state: 'active' | 'archived' = 'active') {
  return subject(ORGANIZATION, { id: 'organization', state });
}

function can(who: Who, action: OrganizationAction, state: 'active' | 'archived' = 'active') {
  return abilities.forPrincipal(principal(who)).can(action, organization(state));
}

describe('organization abilities', () => {
  it.each([
    ['Create … organizations', 'admin', true],
    ['Create … organizations', 'team_member', false],
    ['Create … organizations', 'end_user', false],
  ] as const)('%s – %s: %s', (_row, who, isAllowed) => {
    expect(abilities.forPrincipal(principal(who)).can(CREATE, ORGANIZATION)).toBe(isAllowed);
  });

  it.each([
    ['See an organization', 'read', 'admin', true],
    ['See an organization', 'read', 'team_member', false],
    ['See an organization', 'read', 'end_user', false],
    ['Grant organizations access to projects', 'manage_projects', 'admin', true],
    ['Grant organizations access to projects', 'manage_projects', 'team_member', false],
    ['Manage organization members and e-mail domains', 'manage_members', 'admin', true],
    ['Manage organization members and e-mail domains', 'manage_members', 'team_member', false],
    ['Manage organization members and e-mail domains', 'update', 'admin', true],
    ['Manage organization members and e-mail domains', 'update', 'end_user', false],
    ['Create, archive, unarchive and delete … organizations', 'archive', 'admin', true],
    ['Create, archive, unarchive and delete … organizations', 'archive', 'team_member', false],
    ['Create, archive, unarchive and delete … organizations', 'unarchive', 'admin', true],
    ['Create, archive, unarchive and delete … organizations', 'unarchive', 'team_member', false],
    ['Create, archive, unarchive and delete … organizations', 'delete', 'admin', true],
    ['Create, archive, unarchive and delete … organizations', 'delete', 'end_user', false],
  ] as const)('%s (%s) – %s: %s', (_row, action, who, isAllowed) => {
    expect(can(who, action)).toBe(isAllowed);
  });

  describe('an archived organization', () => {
    it.each([
      ['read', true],
      ['unarchive', true],
      ['delete', true],
      ['update', false],
      ['archive', false],
      ['manage_projects', false],
      ['manage_members', false],
    ] as const)('admin – %s: %s', (action, isAllowed) => {
      expect(can('admin', action, 'archived')).toBe(isAllowed);
    });

    it('denies a change with the code organization.archived', () => {
      const ability = abilities.forPrincipal(principal('admin'));

      const rule = ability.relevantRuleFor('update', organization('archived'));

      expect(reasonCode(rule?.reason)).toBe('organization.archived');
    });
  });
});
