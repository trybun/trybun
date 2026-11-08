// The rows of §7.5 about projects (§18.3, §18.7): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import { type ProjectAction, projectActionSchema } from '@trybun/contracts/projects';
import { describe, expect, it } from 'vitest';
import {
  buildPrincipal,
  buildProjectRecord,
  PRINCIPAL_ID,
  type PrincipalFixture,
} from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedProjectsRestriction,
  CREATE,
  PROJECT,
  projectsAbilities,
} from './projects.abilities.js';

const abilities = new AbilityFactory([projectsAbilities], [archivedProjectsRestriction]);

type State = 'active' | 'archived';

function can(who: PrincipalFixture, action: ProjectAction, state: State = 'active') {
  return abilities.forPrincipal(buildPrincipal(who)).can(action, buildProjectRecord(who, state));
}

function allowedActions(who: PrincipalFixture, state: State) {
  return projectActionSchema.options.filter((action) => can(who, action, state));
}

describe('project abilities', () => {
  it.each([
    ['Create … projects', 'admin', true],
    ['Create … projects', 'project_manager', false],
    ['Create … projects', 'end_user_personal', false],
  ] as const)('%s – %s: %s', (_row, who, isAllowed) => {
    expect(abilities.forPrincipal(buildPrincipal(who)).can(CREATE, PROJECT)).toBe(isAllowed);
  });

  it.each([
    ['(implicit) See a project', 'read', 'developer', true],
    ['(implicit) See a project', 'read', 'end_user_personal', true],
    ['(implicit) See a project', 'read', 'end_user_organization', true],
    ['(implicit) See a project', 'read', 'end_user_archived_organization', false],
    ['(implicit) See a project', 'read', 'end_user', false],
    ['(implicit) See a project', 'read', 'team_member', false],
    ['View project members of own project', 'read_members', 'developer', true],
    ['View project members of own project', 'read_members', 'end_user_personal', false],
    ['View project members of own project', 'read_members', 'team_member', false],
    ['Manage project members', 'manage_members', 'project_manager', true],
    ['Manage project members', 'manage_members', 'admin', true],
    ['Manage project members', 'manage_members', 'developer', false],
    [
      'Project settings: resolution confirmation, WIP limits',
      'update_settings',
      'project_manager',
      true,
    ],
    [
      'Project settings: resolution confirmation, WIP limits',
      'update_settings',
      'developer',
      false,
    ],
    ['Project settings: name, key, …', 'update', 'admin', true],
    ['Project settings: name, key, …', 'update', 'project_manager', false],
    ['Create, archive, unarchive and delete (if empty) projects', 'archive', 'admin', true],
    [
      'Create, archive, unarchive and delete (if empty) projects',
      'archive',
      'project_manager',
      false,
    ],
    ['Create, archive, unarchive and delete (if empty) projects', 'unarchive', 'admin', true],
    [
      'Create, archive, unarchive and delete (if empty) projects',
      'unarchive',
      'project_manager',
      false,
    ],
    ['Create, archive, unarchive and delete (if empty) projects', 'delete', 'admin', true],
    [
      'Create, archive, unarchive and delete (if empty) projects',
      'delete',
      'project_manager',
      false,
    ],
  ] as const)('%s (%s) – %s: %s', (_row, action, who, isAllowed) => {
    expect(can(who, action)).toBe(isAllowed);
  });

  // The actions of the project response for every principal and both states (§18.3).
  it.each([
    ['admin', 'active', projectActionSchema.options],
    ['admin', 'archived', ['read', 'unarchive', 'read_members']],
    ['project_manager', 'active', ['read', 'update_settings', 'read_members', 'manage_members']],
    ['project_manager', 'archived', ['read', 'read_members']],
    ['developer', 'active', ['read', 'read_members']],
    ['developer', 'archived', ['read', 'read_members']],
    ['team_member', 'active', []],
    ['end_user_personal', 'active', ['read']],
    ['end_user_personal', 'archived', ['read']],
    ['end_user_organization', 'active', ['read']],
    ['end_user_organization', 'archived', ['read']],
    ['end_user_archived_organization', 'active', []],
    ['end_user', 'active', []],
  ] as const)('%s on an %s project may perform %o', (who, state, actions) => {
    expect(allowedActions(who, state)).toEqual(actions);
  });

  it.each(['active', 'archived'] as const)(
    'holds the hierarchy on an %s project: Developer ⊆ Project manager ⊆ Administrator (§7.2)',
    (state) => {
      for (const action of projectActionSchema.options) {
        if (can('developer', action, state)) {
          expect(can('project_manager', action, state), action).toBe(true);
        }
        if (can('project_manager', action, state)) {
          expect(can('admin', action, state), action).toBe(true);
        }
      }
    },
  );

  it.each([
    ['a team account with an end_user membership', 'developer', 'end_user'],
    ['an end-user account with a team membership', 'end_user', 'developer'],
    ['an end-user account with a team membership', 'end_user', 'project_manager'],
  ] as const)('grants nothing to %s (§7.1)', (_case, who, role) => {
    const ability = abilities.forPrincipal(buildPrincipal(who));
    const record = subject(PROJECT, {
      id: 'project',
      state: 'active',
      members: [{ userId: PRINCIPAL_ID, role }],
      organizations: [],
    });

    expect(projectActionSchema.options.filter((action) => ability.can(action, record))).toEqual([]);
  });

  it('grants nothing to an end user with the Administrator flag (§7.4)', () => {
    const ability = abilities.forPrincipal({ ...buildPrincipal('end_user'), isAdmin: true });

    expect(ability.can(CREATE, PROJECT)).toBe(false);
    expect(ability.can('read', buildProjectRecord('end_user'))).toBe(false);
  });

  describe('an archived project', () => {
    it('refuses every action of the closed list that is no exception, with project.archived', () => {
      const ability = abilities.forPrincipal(buildPrincipal('admin'));
      const record = buildProjectRecord('admin', 'archived');

      const refused = projectActionSchema.options.filter((action) => !ability.can(action, record));

      expect(refused).toEqual([
        'update',
        'update_settings',
        'archive',
        'delete',
        'manage_members',
        'create_ticket',
        'assign_tickets',
        'assign_tickets_self',
      ]);
      for (const action of refused) {
        expect(reasonCode(ability.relevantRuleFor(action, record)?.reason), action).toBe(
          'project.archived',
        );
      }
    });

    it('denies an action without a rule with 403', () => {
      const ability = abilities.forPrincipal(buildPrincipal('developer'));

      const rule = ability.relevantRuleFor('update', buildProjectRecord('developer'));

      expect(reasonCode(rule?.reason)).toBe('request.forbidden');
    });
  });
});
