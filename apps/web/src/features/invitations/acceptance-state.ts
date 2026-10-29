import { z } from 'zod';
import type { IdentityProvider } from '../sessions/keycloak-sign-in.js';

/**
 * The token of the invitation link `https://<domain>/invitations#token=<token>` (ADR 0009): in the
 * fragment, so it never reaches a server log; `undefined` for an address without one.
 */
export function invitationTokenOf(hash: string): string | undefined {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  return token === null || token === '' ? undefined : token;
}

/**
 * The sign-ins the page starts for the second factor before it gives up (ADR 0009): a new team
 * member needs two – the one that sets up the one-time codes has no `otp` in `amr` yet.
 */
export const MAX_SECOND_FACTOR_SIGN_INS = 3;

const identityProviderSchema = z.enum(['github', 'microsoft', 'google']) satisfies z.ZodType<
  IdentityProvider,
  IdentityProvider
>;

/**
 * The step of an acceptance that continues after a sign-in, kept in the tab's `sessionStorage`
 * (ADR 0009): `accept` – back from a sign-in started from the link, the page accepts with the new
 * session; `verify` – a team member's account is bound, and the page checks that the session has
 * the second factor before it opens the landing path. `provider` is the identity provider the
 * sign-ins go to, `signIns` counts the sign-ins started for the second factor.
 */
const pendingAcceptanceSchema = z.discriminatedUnion('step', [
  z.object({
    step: z.literal('accept'),
    token: z.string().min(1),
    provider: identityProviderSchema.optional(),
    signIns: z.number().int().min(0),
  }),
  z.object({
    step: z.literal('verify'),
    landingPath: z.string().regex(/^\/(?!\/)/),
    provider: identityProviderSchema.optional(),
    signIns: z.number().int().min(0),
  }),
]);
export type PendingAcceptance = z.infer<typeof pendingAcceptanceSchema>;

const STORAGE_KEY = 'trybun.invitation';

/** The pending step of the tab; anything unreadable counts as none. */
export function readPendingAcceptance(storage: Storage): PendingAcceptance | undefined {
  const value = storage.getItem(STORAGE_KEY);
  if (value === null) {
    return undefined;
  }
  try {
    const result = pendingAcceptanceSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

export function writePendingAcceptance(storage: Storage, value: PendingAcceptance): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(value));
}

/** Removes the pending step – and with it the token – once the acceptance has ended. */
export function clearPendingAcceptance(storage: Storage): void {
  storage.removeItem(STORAGE_KEY);
}

/** The browser's time zone, which the account keeps when the API knows it (§13.1). */
export function browserTimeZone(): string | undefined {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return zone === '' || zone.length > 64 ? undefined : zone;
}

/** The acceptance page, where every sign-in started from it returns (ADR 0009). */
export const ACCEPTANCE_PATH = '/invitations';

/** The acceptance page showing a link again, e.g. after signing out of another account. */
export function acceptancePathOf(token: string): string {
  return `${ACCEPTANCE_PATH}#${new URLSearchParams({ token }).toString()}`;
}
