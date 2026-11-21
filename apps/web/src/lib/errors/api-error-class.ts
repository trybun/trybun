import type { ErrorCode } from '@trybun/contracts/errors';
import type { FieldError } from '@trybun/contracts/problem-details';

/**
 * An error response of the API (§17.2, §18.5): its stable code, translated with `errors.<code>`,
 * the invalid fields of a validation error and, when the response says so, the seconds to wait
 * before the next request (`Retry-After` of a `429`, §14.4). Raw server messages are never kept.
 *
 * A module of its own without Zod, so the query client of the browser can tell a refusal from a
 * failure (`retryUnlessRefused`) without bringing Zod into the first load of the shell (§18.5);
 * `toApiError()` of `api-error.ts` parses the response.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly fieldErrors: readonly FieldError[] = [],
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
