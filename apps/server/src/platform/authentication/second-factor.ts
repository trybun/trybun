import type { UserKind } from '@trybun/contracts/users';

/** `amr` values (RFC 8176) of a second factor: a one-time password (TOTP) or a hardware key. */
const SECOND_FACTOR_METHODS = new Set(['otp', 'hwk']);

/** Team members act only after a sign-in with 2FA (§7.4); 2FA is optional for end users. */
export function isSecondFactorSatisfied(userKind: UserKind, amr: readonly string[]): boolean {
  return userKind !== 'team' || amr.some((method) => SECOND_FACTOR_METHODS.has(method));
}
