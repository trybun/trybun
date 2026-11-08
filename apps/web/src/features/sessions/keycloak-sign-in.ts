/** The identity providers of the realm (§7.4): GitHub for team members, Microsoft and Google for end users. */
export type IdentityProvider = 'github' | 'microsoft' | 'google';

/** The optional client scope of `trybun-web` that marks a sign-in started from an invitation (ADR 0009). */
const INVITATION_SCOPE = 'invitation';

export interface KeycloakSignInOptions {
  /** The language of the Keycloak screens (§13.1). */
  locale: string;
  /** Pre-fills the address on the Keycloak sign-in form, e.g. the invited address (ADR 0009). */
  loginHint?: string;
  /** Skips the Keycloak sign-in page and goes straight to the provider. */
  identityProvider?: IdentityProvider;
  /**
   * A provider sign-in started from an invitation link: only then may the first broker login
   * create a Keycloak user (ADR 0009).
   */
  isInvitation?: boolean;
}

/**
 * The authorization parameters of a Keycloak sign-in, which Auth.js 4 adds to the authorization
 * request (`signIn(provider, options, authorizationParams)`).
 */
export function keycloakAuthorizationParams({
  locale,
  loginHint,
  identityProvider,
  isInvitation = false,
}: KeycloakSignInOptions): Record<string, string> {
  return {
    ui_locales: locale,
    ...(loginHint === undefined ? {} : { login_hint: loginHint }),
    ...(identityProvider === undefined ? {} : { kc_idp_hint: identityProvider }),
    ...(isInvitation ? { scope: `openid ${INVITATION_SCOPE}` } : {}),
  };
}

/**
 * Starts a sign-in with Keycloak that returns to `callbackUrl`, a path of the application. Auth.js
 * requires the sign-in to start with a POST from the browser (CSRF token).
 */
export async function signInWithKeycloak(
  callbackUrl: string,
  options: KeycloakSignInOptions,
): Promise<void> {
  const { signIn } = await import('next-auth/react');
  await signIn('keycloak', { callbackUrl }, keycloakAuthorizationParams(options));
}

/**
 * Ends the web session and its Keycloak session without leaving the page, so that the next
 * sign-in asks for the credentials again and is not answered from an earlier session (ADR 0009).
 */
export async function signOutInPlace(): Promise<void> {
  const { signOut } = await import('next-auth/react');
  await signOut({ redirect: false });
}
