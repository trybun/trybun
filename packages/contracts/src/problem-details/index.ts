import { z } from 'zod';
import { errorCodeSchema } from '../errors/index.js';

/** The closed list of field error codes `<kind>.<reason>` of validation responses (§17.2). */
export const fieldErrorCodeSchema = z.enum([
  'string.too_long',
  'string.too_short',
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
