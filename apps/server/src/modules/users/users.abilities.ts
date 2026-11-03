import type { AbilityRules } from '../../platform/authorization/ability-factory.js';

/** The subject of the accounts (§18.3). */
export const USER = 'User';

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
};
