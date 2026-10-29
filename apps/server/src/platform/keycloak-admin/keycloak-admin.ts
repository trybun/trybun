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

/** An end user who accepts an invitation with a password (ADR 0009); the fields of the wizard. */
export type NewEndUser = NewAdministrator;

/** The profile of a Keycloak user that the acceptance of an invitation reads (ADR 0009). */
export interface KeycloakUserProfile {
  firstName: string | null;
  lastName: string | null;
}

/** A Keycloak user as the cleanup of users without an account sees it (AQ2). */
export interface KeycloakUserSummary {
  id: string;
  createdAt: Date;
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
  /**
   * Creates an end user with the password as a credential (ADR 0009). Returns the Keycloak user
   * ID. Throws `invitation.email_taken` for an address that has a Keycloak user and
   * `invitation.password_rejected` for a password the password policy refuses.
   */
  createEndUser(endUser: NewEndUser): Promise<string>;
  /** The names of a Keycloak user; `null` when it does not exist. */
  findUserProfile(keycloakUserId: string): Promise<KeycloakUserProfile | null>;
  /**
   * Sets the verified e-mail address of a Keycloak user, so it equals the address of its account
   * (ADR 0009). Throws `invitation.email_taken` when another Keycloak user has the address.
   */
  setVerifiedEmail(keycloakUserId: string, email: string): Promise<void>;
  /** The GitHub login of a user's linked GitHub account (§11.4); `null` without one. */
  findGithubLogin(keycloakUserId: string): Promise<string | null>;
  /** Adds a user to the group `team`, whose members must use 2FA (§7.4); repeatable. */
  addToTeamGroup(keycloakUserId: string): Promise<void>;
  /** Every user of the realm, except the service accounts of its clients. */
  listUsers(): Promise<KeycloakUserSummary[]>;
  /** Deletes a Keycloak user; a user that no longer exists is ignored. */
  deleteUser(keycloakUserId: string): Promise<void>;
}

export const KEYCLOAK_ADMIN = Symbol('KeycloakAdmin');
