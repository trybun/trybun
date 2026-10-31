import { z } from 'zod';
import { errorCodeSchema } from '../errors/index.js';

/** The closed list of field error codes `<kind>.<reason>` of validation responses (§17.2). */
export const fieldErrorCodeSchema = z.enum([
  'string.too_long',
  'string.too_short',
  'string.empty',
  'string.invalid_format',
  'array.too_long',
  'array.too_short',
  'number.too_large',
  'number.too_small',
  'date.too_late',
  'date.too_early',
  'field.invalid_type',
  'field.invalid_value',
  'field.unrecognized',
  'field.invalid',
]);
export type FieldErrorCode = z.infer<typeof fieldErrorCodeSchema>;

/** A schema issue: Zod issues carry `code` and, for sizes, `origin` besides the Standard Schema message. */
type IssueDetails = { message?: string; code?: string; origin?: string; minimum?: unknown };

type SizeCodes = { tooBig: FieldErrorCode; tooSmall: FieldErrorCode };

const STRING_SIZE: SizeCodes = { tooBig: 'string.too_long', tooSmall: 'string.too_short' };
const ARRAY_SIZE: SizeCodes = { tooBig: 'array.too_long', tooSmall: 'array.too_short' };
const NUMBER_SIZE: SizeCodes = { tooBig: 'number.too_large', tooSmall: 'number.too_small' };
const DATE_SIZE: SizeCodes = { tooBig: 'date.too_late', tooSmall: 'date.too_early' };

/** Size codes by the `origin` of a Zod `too_big` or `too_small` issue. */
const SIZE_CODES: Record<string, SizeCodes> = {
  string: STRING_SIZE,
  array: ARRAY_SIZE,
  set: ARRAY_SIZE,
  number: NUMBER_SIZE,
  bigint: NUMBER_SIZE,
  date: DATE_SIZE,
};

/**
 * Field error code `<kind>.<reason>` (§17.2) of a Zod issue: the same codes for the validation of
 * the API and for the forms of the web application (§18.5).
 */
export function toFieldErrorCode(issue: IssueDetails): FieldErrorCode {
  const { code, origin, minimum } = issue;
  const size = origin === undefined ? undefined : SIZE_CODES[origin];
  switch (code) {
    case 'too_big':
      return size?.tooBig ?? 'field.invalid';
    case 'too_small':
      // A required text (`min(1)`, after `trim()`) that is empty: the form asks for it by name.
      return origin === 'string' && minimum === 1
        ? 'string.empty'
        : (size?.tooSmall ?? 'field.invalid');
    case 'invalid_type':
      return 'field.invalid_type';
    case 'invalid_format':
      return 'string.invalid_format';
    case 'invalid_value':
      return 'field.invalid_value';
    case 'unrecognized_keys':
      return 'field.unrecognized';
    default:
      return 'field.invalid';
  }
}

/** A field error of a validation response: JSON Pointer to the field and an error code (§17.2). */
export const fieldErrorSchema = z.object({
  pointer: z.string(),
  code: fieldErrorCodeSchema,
});
export type FieldError = z.infer<typeof fieldErrorSchema>;

/** Error response in the Problem Details format (RFC 9457) with a stable error code (§17.2). */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  code: errorCodeSchema,
  errors: z.array(fieldErrorSchema).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
