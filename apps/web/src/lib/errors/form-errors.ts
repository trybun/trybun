import type { ErrorCode } from '@trybun/contracts/errors';
import { type FieldErrorCode, toFieldErrorCode } from '@trybun/contracts/problem-details';
import type { ApiError } from './api-error.js';

/**
 * The error map of the Zod resolver of a form (§18.5): a field error code instead of Zod's English
 * message, the same codes the API returns, translated where the error is shown.
 */
export const FORM_ERROR_MAP = { error: toFieldErrorCode };

/**
 * The field errors of a Problem Details response for a form (§18.5): `errors[].pointer` names the
 * field (`/email` → `email`). A validation error gives the code of each field error; a rule of the
 * API (e.g. `setup.email_taken`) gives its own code at its field.
 */
export function fieldErrorsOf(
  error: ApiError,
): { field: string; code: ErrorCode | FieldErrorCode }[] {
  return error.fieldErrors.map((fieldError) => ({
    field: fieldError.pointer.replace(/^\//, '').replaceAll('/', '.'),
    code: error.code === 'request.validation_failed' ? fieldError.code : error.code,
  }));
}
