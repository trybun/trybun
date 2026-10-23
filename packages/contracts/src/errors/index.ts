import { z } from 'zod';

/** The closed list of error codes of the API (§17.1, §17.2). */
export const errorCodeSchema = z.enum([
  'request.validation_failed',
  'authentication.required',
  'authentication.second_factor_required',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** HTTP status of each error code. */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  'request.validation_failed': 422,
  // No valid access token or API token, or no active account for it (§14.4).
  'authentication.required': 401,
  // A team member whose sign-in did not complete 2FA (§7.4).
  'authentication.second_factor_required': 401,
};
