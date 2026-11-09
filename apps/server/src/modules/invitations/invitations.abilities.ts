import { subject } from '@casl/ability';
import { invitationActionSchema } from '@trybun/contracts/invitations';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Principal } from '../../platform/authentication/principal.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import { teamRolesFrom } from '../../platform/authorization/project-roles.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';

/** The subject of the invitations (§18.3). */
export const INVITATION = 'Invitation';

/** Issuing an invitation, checked on the invitation it would create (§7.4). */
export const CREATE = 'create';

/** The changes of invitations: issuing one and the actions of the contract's closed list. */
const CHANGES = [CREATE, ...invitationActionSchema.options];

const ALL_ACTIONS = ['read', ...CHANGES];

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
    project: {
      is: {
        members: {
          some: { userId: principal.userId, role: { in: teamRolesFrom('project_manager') } },
        },
      },
    },
  });
};

/**
 * A global restriction (§18.3), added after every rule: an invitation to an archived project or
 * organization can be neither issued, resent nor revoked (§7.3, §7.4), for everyone. Its reason
 * makes the API answer `409` with the code of the archived target before a `403`. The organization
 * counts only for its own target: a project invitation of an end user also stores the
 * organization matched by domain, whose archiving does not block it.
 */
export const archivedTargetsOfInvitationsRestriction: AbilityRules = ({ cannot }) => {
  cannot(CHANGES, INVITATION, { project: { is: { state: 'archived' } } }).because(
    'project.archived',
  );
  cannot(CHANGES, INVITATION, {
    target: 'organization',
    organization: { is: { state: 'archived' } },
  }).because('organization.archived');
};

/**
 * The fields of an invitation its rules read (§18.3): the state of its project and organization
 * and the principal's membership of the project.
 */
export function invitationRuleSelect(principal: Principal) {
  return {
    target: true,
    project: {
      select: {
        state: true,
        members: { where: { userId: principal.userId }, select: { userId: true, role: true } },
      },
    },
    organization: { select: { state: true } },
  } satisfies Prisma.InvitationSelect;
}

/** How the record access loads an invitation (§18.3). */
export const invitationRecords: RecordDescriptor<'Invitation'> = {
  subject: INVITATION,
  async find(db, where, principal) {
    const row = await db.invitation.findFirst({ where, select: invitationRuleSelect(principal) });
    return row === null ? null : subject(INVITATION, row);
  },
};
