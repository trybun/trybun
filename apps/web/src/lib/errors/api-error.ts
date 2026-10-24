import type { ErrorCode } from '@trybun/contracts/errors';
import { type FieldError, problemDetailsSchema } from '@trybun/contracts/problem-details';

/** Statuses of a gateway or proxy in front of an API that is down (Caddy, §15.9). */
const UNAVAILABLE_STATUSES = new Set([502, 503, 504]);

/**
 * An error response of the API (§17.2, §18.5): its stable code, translated with `errors.<code>`,
 * and the invalid fields of a validation error. Raw server messages are never kept.
 */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    readonly fieldErrors: readonly FieldError[] = [],
  ) {
    super(code);
  }
}

/** The `ApiError` of a failed response; a body that is not Problem Details keeps only its status. */
export async function toApiError(response: Response): Promise<ApiError> {
  const body: unknown = await response.json().catch(() => undefined);
  return apiErrorOf(response.status, body);
}

/** The `ApiError` of a failed response whose body has already been parsed (`openapi-fetch`). */
export function apiErrorOf(status: number, body: unknown): ApiError {
  const problem = problemDetailsSchema.safeParse(body);
  if (problem.success) {
    return new ApiError(status, problem.data.code, problem.data.errors);
  }
  return new ApiError(
    status,
    UNAVAILABLE_STATUSES.has(status) ? 'server.unavailable' : 'server.internal_error',
  );
}
