// The rows of §7.5 about projects (§18.3): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import type { ProjectAction } from '@trybun/contracts/projects';
import { describe, expect, it } from 'vitest';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedProjectsRestriction,
  CREATE,
  PROJECT,
  projectsAbilities,
} from './projects.abilities.js';

const abilities = new AbilityFactory([projectsAbilities], [archivedProjectsRestriction]);

const USER_ID = '0190f2f4-7c1e-7000-8000-000000000001';

type Who = 'admin' | 'project_manager' | 'developer' | 'outsider' | 'end_user';

function principal(who: Who): UserPrincipal {
  return {
    kind: 'user',
    userId: USER_ID,
    userKind: who === 'end_user' ? 'end_user' : 'team',
    isAdmin: who === 'admin',
  };
}

/** A project as the record access loads it: with the principal's own membership. */
function project(who: Who, state: 'active' | 'archived' = 'active') {
  const members =
    who === 'project_manager' || who === 'developer' ? [{ userId: USER_ID, role: who }] : [];
  return subject(PROJECT, { id: 'project', state, members });
}

function can(who: Who, action: ProjectAction, state: 'active' | 'archived' = 'active') {
  return abilities.forPrincipal(principal(who)).can(action, project(who, state));
}

describe('project abilities', () => {
  it.each([
    ['Create projects', 'admin', true],
    ['Create projects', 'project_manager', false],
    ['Create projects', 'end_user', false],
  ] as const)('%s – %s: %s', (_row, who, isAllowed) => {
    expect(abilities.forPrincipal(principal(who)).can(CREATE, PROJECT)).toBe(isAllowed);
  });

  it.each([
    ['See a project', 'read', 'developer', true],
    ['See a project', 'read', 'outsider', false],
    ['See a project', 'read', 'end_user', false],
    ['View project members', 'read_members', 'developer', true],
    ['View project members', 'read_members', 'outsider', false],
    ['Manage project members', 'manage_members', 'project_manager', true],
    ['Manage project members', 'manage_members', 'admin', true],
    ['Manage project members', 'manage_members', 'developer', false],
    ['Project settings: resolution confirmation', 'update_settings', 'project_manager', true],
    ['Project settings: resolution confirmation', 'update_settings', 'developer', false],
    ['Project settings: name, key', 'update', 'admin', true],
    ['Project settings: name, key', 'update', 'project_manager', false],
    ['Archive projects', 'archive', 'admin', true],
    ['Archive projects', 'archive', 'project_manager', false],
    ['Unarchive projects', 'unarchive', 'admin', true],
    ['Unarchive projects', 'unarchive', 'project_manager', false],
    ['Delete projects', 'delete', 'admin', true],
    ['Delete projects', 'delete', 'project_manager', false],
  ] as const)('%s (%s) – %s: %s', (_row, action, who, isAllowed) => {
    expect(can(who, action)).toBe(isAllowed);
  });

  describe('an archived project', () => {
    it.each([
      ['admin', 'read', true],
      ['admin', 'read_members', true],
      ['admin', 'unarchive', true],
      ['developer', 'read', true],
      ['admin', 'update', false],
      ['admin', 'update_settings', false],
      ['admin', 'archive', false],
      ['admin', 'delete', false],
      ['admin', 'manage_members', false],
      ['project_manager', 'update_settings', false],
      ['project_manager', 'manage_members', false],
    ] as const)('%s – %s: %s', (who, action, isAllowed) => {
      expect(can(who, action, 'archived')).toBe(isAllowed);
    });

    it('denies a change with the code project.archived', () => {
      const ability = abilities.forPrincipal(principal('admin'));

      const rule = ability.relevantRuleFor('update', project('admin', 'archived'));

      expect(reasonCode(rule?.reason)).toBe('project.archived');
    });

    it('denies an action without a rule with 403', () => {
      const ability = abilities.forPrincipal(principal('developer'));

      const rule = ability.relevantRuleFor('update', project('developer'));

      expect(reasonCode(rule?.reason)).toBe('request.forbidden');
    });
  });
});
