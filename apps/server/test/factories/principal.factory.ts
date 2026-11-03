import { subject } from '@casl/ability';
import type { UserPrincipal } from '../../src/platform/authentication/principal.js';

export const PRINCIPAL_ID = '0190f2f4-7c1e-7000-8000-000000000001';

/**
 * The principals of the permission tests (§18.7), each named after its relation to the project of
 * the records below: a member with a team role, a team account without membership, and end users
 * with personal access, with access through an active or an archived organization, or without
 * access.
 */
export const PRINCIPAL_FIXTURES = [
  'admin',
  'project_manager',
  'developer',
  'team_member',
  'end_user_personal',
  'end_user_organization',
  'end_user_archived_organization',
  'end_user',
] as const;

export type PrincipalFixture = (typeof PRINCIPAL_FIXTURES)[number];

export function buildPrincipal(fixture: PrincipalFixture): UserPrincipal {
  return {
    kind: 'user',
    userId: PRINCIPAL_ID,
    userKind: fixture.startsWith('end_user') ? 'end_user' : 'team',
    isAdmin: fixture === 'admin',
  };
}

/** The principal's own membership of the project, as the record descriptors load it. */
export function buildMembers(fixture: PrincipalFixture): { userId: string; role: string }[] {
  switch (fixture) {
    case 'project_manager':
    case 'developer':
      return [{ userId: PRINCIPAL_ID, role: fixture }];
    case 'end_user_personal':
      return [{ userId: PRINCIPAL_ID, role: 'end_user' }];
    default:
      return [];
  }
}

/** The access of the principal's organization to the project, as the project descriptor loads it. */
function buildOrganizationAccess(fixture: PrincipalFixture) {
  switch (fixture) {
    case 'end_user_organization':
      return [{ organization: { state: 'active', members: [{ userId: PRINCIPAL_ID }] } }];
    case 'end_user_archived_organization':
      return [{ organization: { state: 'archived', members: [{ userId: PRINCIPAL_ID }] } }];
    default:
      return [];
  }
}

/** A project as its record descriptor loads it for the principal of a fixture. */
export function buildProjectRecord(
  fixture: PrincipalFixture,
  state: 'active' | 'archived' = 'active',
) {
  return subject('Project', {
    id: 'project',
    state,
    members: buildMembers(fixture),
    organizations: buildOrganizationAccess(fixture),
  });
}

/**
 * An invitation as its record descriptor loads it for the principal of a fixture: its target, the
 * state of its project and organization – the organization of a project invitation is the one
 * matched by domain, if any – and the principal's membership of the project.
 */
export function buildInvitationRecord(
  fixture: PrincipalFixture,
  target: 'project' | 'organization' | 'administrator',
  states: { project?: 'active' | 'archived'; organization?: 'active' | 'archived' } = {},
) {
  const organizationState = states.organization ?? (target === 'organization' ? 'active' : null);
  return subject('Invitation', {
    target,
    project:
      target === 'project'
        ? { state: states.project ?? 'active', members: buildMembers(fixture) }
        : null,
    organization: organizationState === null ? null : { state: organizationState },
  });
}
