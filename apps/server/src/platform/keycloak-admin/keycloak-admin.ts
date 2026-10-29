import type { Language } from '@trybun/contracts/users';

/** The break-glass Administrator to create in Keycloak (§7.4, §15.6). */
export interface NewAdministrator {
  email: string;
  /** Both names are required by the user profile of Keycloak, else it asks for them at sign-in. */
  firstName: string;
  lastName: string;
  /** Passed to Keycloak once, never stored or logged by the system. */
  password: string;
  language: Language;
}

/**
 * The Keycloak Admin API (§14.4), an external service (§18.3), used with the service account of
 * the client `trybun-server`.
 */
export interface KeycloakAdmin {
  /**
   * Creates a team member with the password as a credential and the required action "configure
   * OTP", so Keycloak enforces 2FA at the first sign-in (§15.5). Returns the Keycloak user ID.
   * Throws `setup.email_taken` for an address that has a Keycloak user and
   * `setup.password_rejected` for a password the password policy refuses.
   */
  createAdministrator(administrator: NewAdministrator): Promise<string>;

  /** Deletes a Keycloak user; a user that no longer exists is ignored. */
  deleteUser(keycloakUserId: string): Promise<void>;

  /**
   * Enables or disables a Keycloak user (§7.4): a disabled user cannot sign in. A user that no
   * longer exists is ignored.
   */
  setUserEnabled(keycloakUserId: string, enabled: boolean): Promise<void>;

  /** Ends every Keycloak session of a user (§7.4); a user that no longer exists is ignored. */
  logoutUser(keycloakUserId: string): Promise<void>;
}

export const KEYCLOAK_ADMIN = Symbol('KeycloakAdmin');
