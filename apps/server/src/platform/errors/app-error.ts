import { ERROR_HTTP_STATUS, type ErrorCode } from '@trybun/contracts/errors';
import type { FieldError } from '@trybun/contracts/problem-details';

/**
 * An expected error of the API (§18.3): a code from the closed list of `@trybun/contracts`, which
 * defines its HTTP status, and optional field errors. It has no framework dependencies, so domain
 * rules throw it too; the global exception filter renders it as Problem Details.
 */
export class AppError extends Error {
  override readonly name = 'AppError';
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    readonly errors?: readonly FieldError[],
  ) {
    super(code);
    this.status = ERROR_HTTP_STATUS[code];
  }
}
