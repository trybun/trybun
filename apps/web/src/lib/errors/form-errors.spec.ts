import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ApiError } from './api-error.js';
import { FORM_ERROR_MAP, fieldErrorsOf } from './form-errors.js';

describe('fieldErrorsOf', () => {
  it('gives the field error codes of a validation error', () => {
    const error = new ApiError(422, 'request.validation_failed', [
      { pointer: '/email', code: 'string.invalid_format' },
      { pointer: '/address/city', code: 'string.too_long' },
    ]);

    expect(fieldErrorsOf(error)).toEqual([
      { field: 'email', code: 'string.invalid_format' },
      { field: 'address.city', code: 'string.too_long' },
    ]);
  });

  it('gives the code of a rule of the API at its field', () => {
    const error = new ApiError(422, 'setup.email_taken', [
      { pointer: '/email', code: 'field.invalid' },
    ]);

    expect(fieldErrorsOf(error)).toEqual([{ field: 'email', code: 'setup.email_taken' }]);
  });
});

describe('FORM_ERROR_MAP', () => {
  it('turns a Zod issue into its field error code', () => {
    const result = z.object({ name: z.string().min(1) }).safeParse({ name: '' }, FORM_ERROR_MAP);

    expect(result.error?.issues[0]?.message).toBe('string.too_short');
  });
});
