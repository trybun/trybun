/** Queue of the recurring work of invitations (§17.1). */
export const INVITATIONS_QUEUE = 'invitations';

/**
 * Recurring job deleting the Keycloak users without an account 24 hours after their creation
 * (AQ2 of the invitation acceptance); also its scheduler ID.
 */
export const KEYCLOAK_USER_CLEANUP_JOB = 'invitations-keycloak-user-cleanup';
