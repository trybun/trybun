// The rows of §7.5 about organizations (§18.3): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import { type OrganizationAction, organizationActionSchema } from '@trybun/contracts/organizations';
import { describe, expect, it } from 'vitest';
import {
  buildPrincipal,
  type PrincipalFixture,
} from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedOrganizationsRestriction,
  CREATE,
  ORGANIZATION,
  organizationsAbilities,
} from './organizations.abilities.js';

const abilities = new AbilityFactory([organizationsAbilities], [archivedOrganizationsRestriction]);

type Who = Extract<
  PrincipalFixture,
  'admin' | 'project_manager' | 'team_member' | 'end_user_organization' | 'end_user'
>;

function organization(state: 'active' | 'archived' = 'active') {
  return subject(ORGANIZATION, { id: 'organization', state });
}

function can(who: Who, action: OrganizationAction, state: 'active' | 'archived' = 'active') {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, organization(state));
}

describe('organization abilities', () => {
  it.each([
    ['Create … organizations', 'admin', true],
    ['Create … organizations', 'team_member', false],
    ['Create … organizations', 'end_user', false],
  ] as const)('%s – %s: %s', (_row, who, isAllowed) => {
    expect(abilities.forPrincipal(buildPrincipal(who)).can(CREATE, ORGANIZATION)).toBe(isAllowed);
  });

  it.each([
    ['See an organization', 'read', 'admin', true],
    ['See an organization', 'read', 'team_member', false],
    ['See an organization', 'read', 'project_manager', false],
    ['See an organization', 'read', 'end_user_organization', false],
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

    it('refuses every action of the closed list that is no exception, with organization.archived', () => {
      const ability = abilities.forPrincipal(buildPrincipal('admin'));
      const record = organization('archived');

      const refused = organizationActionSchema.options.filter(
        (action) => !ability.can(action, record),
      );

      expect(refused).toEqual(['update', 'archive', 'manage_projects', 'manage_members']);
      for (const action of refused) {
        expect(reasonCode(ability.relevantRuleFor(action, record)?.reason), action).toBe(
          'organization.archived',
        );
      }
    });
  });
});
