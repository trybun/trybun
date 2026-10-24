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
  'authentication.required',
  'authentication.second_factor_required',
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
  // No valid access token or API token, or no active account for it (§14.4).
  'authentication.required': 401,
  // A team member whose sign-in did not complete 2FA (§7.4).
  'authentication.second_factor_required': 401,
  // An unexpected error; the response carries no details (§18.3).
  'server.internal_error': 500,
  // PostgreSQL is unavailable (§17.2).
  'server.unavailable': 503,
};
