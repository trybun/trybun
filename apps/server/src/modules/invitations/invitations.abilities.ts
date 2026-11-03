import type { InvitationAction } from '@trybun/contracts/invitations';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';

/** The subject of the invitations (§18.3). */
export const INVITATION = 'Invitation';

/** Issuing an invitation, checked on the invitation it would create (§7.4). */
export const CREATE = 'create';

const ALL_ACTIONS: readonly (InvitationAction | 'read' | typeof CREATE)[] = [
  CREATE,
  'read',
  'resend',
  'revoke',
];

/**
 * The rules of invitations (§7.4, §7.5): the Administrator issues, sees, resends and revokes every
 * invitation; a Project manager those with the target `project` of their projects. Developers and
 * end users issue none, and invitations are invisible to them. The permission layer (S1-04) adds
 * these rows to its matrix.
 */
export const invitationsAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.userKind !== 'team') {
    return;
  }
  if (principal.isAdmin) {
    can([...ALL_ACTIONS], INVITATION);
    return;
  }
  can([...ALL_ACTIONS], INVITATION, {
    target: 'project',
    // `is`: the in-memory check of a record supports a to-one relation only in this form.
    project: { is: { members: { some: { userId: principal.userId, role: 'project_manager' } } } },
  });
};
