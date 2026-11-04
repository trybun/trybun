import { subject } from '@casl/ability';
import type { Prisma } from '../../generated/prisma/client.js';
import type { UserState } from '../../generated/prisma/enums.js';
import type { AbilityRules } from '../../platform/authorization/ability-factory.js';
import type { RecordDescriptor } from '../../platform/authorization/record-descriptor.js';

/** The subject of the accounts (§18.3). */
export const USER = 'User';

/** The account states whose kind and e-mail address can change: not anonymized (§13.2). */
const CHANGEABLE_STATES: UserState[] = ['invited', 'active', 'deactivated'];

/**
 * The account rules (§7.4, §7.5): only the Administrator sees the accounts and changes their
 * state and the Administrator role; for everyone else they are invisible. Nobody deactivates their
 * own account or revokes their own Administrator role. The rule of the last active Administrator
 * depends on the other accounts, so the service checks it.
 */
export const usersAbilities: AbilityRules = ({ can }, principal) => {
  if (principal.userKind !== 'team' || !principal.isAdmin) {
    return;
  }
  can('read', USER);
  can('deactivate', USER, { state: { in: ['invited', 'active'] }, id: { not: principal.userId } });
  can('reactivate', USER, { state: 'deactivated' });
  can('grant_admin', USER, { kind: 'team', state: 'active', isAdmin: false });
  can('revoke_admin', USER, { isAdmin: true, id: { not: principal.userId } });
  // The kind and e-mail address change (§7.1, §7.4): their codes and endpoints join the contract
  // with S1-20, so `allowedActions` never offers them before then. Nobody changes the kind of
  // their own account (§7.4).
  can('change_kind', USER, { state: { in: CHANGEABLE_STATES }, id: { not: principal.userId } });
  can('change_email', USER, { state: { in: CHANGEABLE_STATES } });
};

/** The fields of an account its rules read (§18.3). */
export const USER_RULE_SELECT = {
  id: true,
  kind: true,
  state: true,
  isAdmin: true,
} satisfies Prisma.UserSelect;

/** How the record access loads an account (§18.3). */
export const userRecords: RecordDescriptor<'User'> = {
  subject: USER,
  async find(db, where) {
    const row = await db.user.findFirst({ where, select: USER_RULE_SELECT });
    return row === null ? null : subject(USER, row);
  },
};
