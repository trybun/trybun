import { signInWithKeycloak, signOutInPlace } from '../sessions/keycloak-sign-in.js';
import {
  ACCEPTANCE_PATH,
  type PendingAcceptance,
  writePendingAcceptance,
} from './acceptance-state.js';

/**
 * Starts a sign-in that continues the acceptance on its page (ADR 0009): keeps the step – with the
 * token – in the tab's `sessionStorage`, ends the session of the browser first, so that neither
 * Auth.js nor Keycloak answers with an earlier session, and signs in through the step's provider.
 * `isInvitation` lets the first broker login create the Keycloak user of a new account.
 */
export async function signInToContinue(
  pending: PendingAcceptance,
  {
    locale,
    loginHint,
    isInvitation = false,
  }: { locale: string; loginHint?: string; isInvitation?: boolean },
): Promise<void> {
  writePendingAcceptance(window.sessionStorage, pending);
  await signOutInPlace();
  await signInWithKeycloak(ACCEPTANCE_PATH, {
    locale,
    loginHint,
    identityProvider: pending.provider,
    isInvitation,
  });
}
