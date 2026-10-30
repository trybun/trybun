// The rows of §7.5 about invitations (§18.3): each with an allowed and a denied case.
import { subject } from '@casl/ability';
import { describe, expect, it } from 'vitest';
import type { UserPrincipal } from '../../platform/authentication/principal.js';
import { AbilityFactory } from '../../platform/authorization/ability-factory.js';
import { CREATE, INVITATION, invitationsAbilities } from './invitations.abilities.js';

const abilities = new AbilityFactory([invitationsAbilities], []);

const USER_ID = '0190f2f4-7c1e-7000-8000-000000000001';

type Who = 'admin' | 'project_manager' | 'developer' | 'end_user';

function principal(who: Who): UserPrincipal {
  return {
    kind: 'user',
    userId: USER_ID,
    userKind: who === 'end_user' ? 'end_user' : 'team',
    isAdmin: who === 'admin',
  };
}

/** An invitation as the record access loads it: with the principal's membership of its project. */
function invitation(who: Who, target: 'project' | 'organization' | 'administrator') {
  const members =
    who === 'project_manager' || who === 'developer' ? [{ userId: USER_ID, role: who }] : [];
  return subject(INVITATION, { target, project: target === 'project' ? { members } : null });
}

describe('invitation abilities', () => {
  it.each([
    ['Invite to own project', 'admin', 'project', true],
    ['Invite to own project', 'project_manager', 'project', true],
    ['Invite to own project', 'developer', 'project', false],
    ['Invite to own project', 'end_user', 'project', false],
    ['Invite to an organization', 'admin', 'organization', true],
    ['Invite to an organization', 'project_manager', 'organization', false],
    ['Invite to the Administrator role', 'admin', 'administrator', true],
    ['Invite to the Administrator role', 'project_manager', 'administrator', false],
  ] as const)('%s – %s, target %s: %s', (_row, who, target, isAllowed) => {
    expect(abilities.forPrincipal(principal(who)).can(CREATE, invitation(who, target))).toBe(
      isAllowed,
    );
  });

  it.each([
    ['read', 'project_manager', true],
    ['resend', 'project_manager', true],
    ['revoke', 'project_manager', true],
    ['read', 'developer', false],
    ['revoke', 'developer', false],
    ['read', 'end_user', false],
    ['revoke', 'admin', true],
  ] as const)(
    'View, resend and revoke invitations of own project – %s by %s: %s',
    (action, who, isAllowed) => {
      expect(abilities.forPrincipal(principal(who)).can(action, invitation(who, 'project'))).toBe(
        isAllowed,
      );
    },
  );
});
