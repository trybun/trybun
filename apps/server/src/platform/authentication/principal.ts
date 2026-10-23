import type { UserKind } from '@trybun/contracts/users';

/**
 * The identity a request acts as (§18.3), resolved once per request by the authentication guard
 * and passed to service methods as their first parameter. Roles come from the database, never
 * from token claims (§14.4).
 */
export interface UserPrincipal {
  kind: 'user';
  userId: string;
  userKind: UserKind;
  isAdmin: boolean;
}

/** API tokens and the system principal join with their tasks (§12.2). */
export type Principal = UserPrincipal;
