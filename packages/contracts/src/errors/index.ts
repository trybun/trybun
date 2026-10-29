import { z } from 'zod';

/**
 * The closed list of error codes of the API (§17.1, §17.2). Feature tasks add the codes of their
 * rules (e.g. `ticket.visibility_not_allowed`); the codes of the request pipeline are shared.
 */
export const errorCodeSchema = z.enum([
  'request.malformed',
  'request.not_found',
  'request.forbidden',
  'request.precondition_failed',
  'request.too_large',
  'request.validation_failed',
  'request.precondition_required',
  'request.rate_limited',
  'authentication.required',
  'authentication.second_factor_required',
  'setup.token_invalid',
  'setup.completed',
  'setup.password_rejected',
  'setup.email_taken',
  'project.archived',
  'project.key_taken',
  'project_member.exists',
  'project_member.user_not_eligible',
  'organization.name_taken',
  'organization.domain_public',
  'organization.domain_taken',
  'organization.archived',
  'organization.not_empty',
  'organization.member_not_found',
  'organization.member_not_end_user',
  'organization.member_of_other_organization',
  'invitation.account_kind_mismatch',
  'invitation.account_deactivated',
  'invitation.access_exists',
  'invitation.organization_conflict',
  'invitation.github_sign_in_missing',
  'invitation.not_pending',
  'invitation.account_mismatch',
  'invitation.token_invalid',
  'user.last_administrator',
  'server.internal_error',
  'server.unavailable',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** HTTP status of each error code. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  // A body that is not valid JSON.
  'request.malformed': 400,
  // A missing route, or a record that does not exist or that the principal may not see (§17.2).
  'request.not_found': 404,
  // An action the principal may not perform on a record they can see (§17.2).
  'request.forbidden': 403,
  // A stale `If-Match`: the record was changed by someone else (§17.2).
  'request.precondition_failed': 412,
  'request.too_large': 413,
  'request.validation_failed': 422,
  // A change of a versioned record without `If-Match` (§17.2).
  'request.precondition_required': 428,
  // More requests than the rate limit of the principal or the client IP allows (§14.4).
  'request.rate_limited': 429,
  // No valid access token or API token, or no active account for it (§14.4).
  'authentication.required': 401,
  // A team member whose sign-in did not complete 2FA (§7.4).
  'authentication.second_factor_required': 401,
  // An unknown, expired or used setup token, all with the same response (§15.6).
  'setup.token_invalid': 404,
  // The first-run wizard after an Administrator exists: disabled permanently (§15.6).
  'setup.completed': 409,
  // A password the password policy of Keycloak refuses (§7.4).
  'setup.password_rejected': 422,
  // An e-mail address that already has a Keycloak account.
  'setup.email_taken': 422,
  // A change of an archived project, which is read-only until it is unarchived (§7.3).
  'project.archived': 409,
  // A key that another active or archived project has (§3.1).
  'project.key_taken': 422,
  // The account is already a member of the project (§7.4).
  'project_member.exists': 409,
  // A member must be an active team account (§7.4).
  'project_member.user_not_eligible': 422,
  // The name is used by another active or archived organization (§7.3).
  'organization.name_taken': 409,
  // A domain on the blocklist of public mail domains, e.g. `gmail.com` (§7.3).
  'organization.domain_public': 422,
  // A domain of another active or archived organization (§7.3).
  'organization.domain_taken': 409,
  // A change of an archived organization, which is read-only until it is unarchived (§7.3).
  'organization.archived': 409,
  // Deleting an organization that has tickets (§7.3).
  'organization.not_empty': 409,
  // No account with the e-mail address (§7.3).
  'organization.member_not_found': 422,
  // Only end users belong to organizations (§7.3).
  'organization.member_not_end_user': 422,
  // The account belongs to another organization and the move was not confirmed (§7.3).
  'organization.member_of_other_organization': 409,
  // The address has an account of the other kind; a kind change is an Administrator action (§7.4).
  'invitation.account_kind_mismatch': 422,
  // The address has a deactivated account, which the Administrator reactivates first (§7.4).
  'invitation.account_deactivated': 422,
  // The account already has the access the invitation would grant (§7.4).
  'invitation.access_exists': 409,
  // An end user of another organization invited to an organization; moving is an Administrator action (§7.3).
  'invitation.organization_conflict': 422,
  // A team invitation while GitHub sign-in is not configured (§15.6).
  'invitation.github_sign_in_missing': 422,
  // Resending or revoking an invitation that was used or revoked (§7.4).
  'invitation.not_pending': 409,
  // A further link of an active account accepted by the session of another account (§7.4).
  'invitation.account_mismatch': 403,
  // An unknown, expired, used, revoked or replaced invitation token, all with the same response (ADR 0009).
  'invitation.token_invalid': 404,
  // Deactivating or demoting the last active Administrator (§7.4).
  'user.last_administrator': 409,
  // An unexpected error; the response carries no details (§18.3).
  'server.internal_error': 500,
  // PostgreSQL is unavailable (§17.2).
  'server.unavailable': 503,
};
