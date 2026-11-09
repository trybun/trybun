// The rows of §7.5 about invitations (§18.3, §18.7): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import {
  buildInvitationRecord,
  buildPrincipal,
  PRINCIPAL_ID,
  type PrincipalFixture,
} from '../../../test/factories/principal.factory.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { reasonCode } from '../../platform/authorization/prisma-record-access.js';
import {
  archivedTargetsOfInvitationsRestriction,
  CREATE,
  INVITATION,
  invitationsAbilities,
} from './invitations.abilities.js';
import { FixedClock } from '../../../test/fixed-clock.js';

const abilities = new AbilityFactory(
  [invitationsAbilities],
  [archivedTargetsOfInvitationsRestriction],
  new FixedClock(),
);

type Target = 'project' | 'organization' | 'administrator';
type Action = typeof CREATE | 'read' | 'resend' | 'revoke';

function can(who: PrincipalFixture, action: Action, target: Target) {
  return abilities
    .forPrincipal(buildPrincipal(who))
    .can(action, buildInvitationRecord(who, target));
}

const ACTIONS: readonly Action[] = [CREATE, 'read', 'resend', 'revoke'];

describe('invitation abilities', () => {
  it.each([
    ['Invite individual end users to the project', 'admin', 'project', true],
    ['Invite individual end users to the project', 'project_manager', 'project', true],
    ['Invite individual end users to the project', 'developer', 'project', false],
    ['Invite individual end users to the project', 'end_user_personal', 'project', false],
    ['Invite end users to an organization', 'admin', 'organization', true],
    ['Invite end users to an organization', 'project_manager', 'organization', false],
    ['Grant or revoke the Administrator role', 'admin', 'administrator', true],
    ['Grant or revoke the Administrator role', 'project_manager', 'administrator', false],
  ] as const)('%s – %s, target %s: %s', (_row, who, target, isAllowed) => {
    expect(can(who, CREATE, target)).toBe(isAllowed);
  });

  it.each([
    ['read', 'project_manager', true],
    ['resend', 'project_manager', true],
    ['revoke', 'project_manager', true],
    ['revoke', 'admin', true],
    ['read', 'developer', false],
    ['revoke', 'developer', false],
    ['read', 'team_member', false],
    ['read', 'end_user_personal', false],
  ] as const)(
    'View, resend and revoke invitations of own project – %s by %s: %s',
    (action, who, isAllowed) => {
      expect(can(who, action, 'project')).toBe(isAllowed);
    },
  );

  it('holds the hierarchy: Developer ⊆ Project manager ⊆ Administrator (§7.2)', () => {
    for (const action of ACTIONS) {
      if (can('developer', action, 'project')) {
        expect(can('project_manager', action, 'project'), action).toBe(true);
      }
      if (can('project_manager', action, 'project')) {
        expect(can('admin', action, 'project'), action).toBe(true);
      }
    }
  });

  it('grants nothing for a membership that contradicts the account kind (§7.1)', () => {
    const record = subject(INVITATION, {
      target: 'project',
      project: { state: 'active', members: [{ userId: PRINCIPAL_ID, role: 'end_user' }] },
      organization: null,
    });

    expect(abilities.forPrincipal(buildPrincipal('developer')).can(CREATE, record)).toBe(false);
  });

  describe('an archived target', () => {
    it.each([
      ['project', { project: 'archived' }, 'admin', 'project.archived'],
      ['project', { project: 'archived' }, 'project_manager', 'project.archived'],
      // The restriction comes before the missing rule (§17.2).
      ['project', { project: 'archived' }, 'developer', 'project.archived'],
      ['organization', { organization: 'archived' }, 'admin', 'organization.archived'],
    ] as const)(
      'refuses every change of a %s invitation %o for %s with %s',
      (target, states, who, code) => {
        const ability = abilities.forPrincipal(buildPrincipal(who));
        const record = buildInvitationRecord(who, target, states);

        for (const action of [CREATE, 'resend', 'revoke'] as const) {
          expect(ability.can(action, record), action).toBe(false);
          expect(reasonCode(ability.relevantRuleFor(action, record)?.reason), action).toBe(code);
        }
        expect(ability.can('read', record)).toBe(who !== 'developer');
      },
    );

    it('keeps a project invitation whose organization matched by domain is archived', () => {
      const ability = abilities.forPrincipal(buildPrincipal('admin'));
      const record = buildInvitationRecord('admin', 'project', { organization: 'archived' });

      expect(ACTIONS.filter((action) => ability.can(action, record))).toEqual(ACTIONS);
    });
  });
});
