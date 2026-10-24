import type { StandardSchemaV1 } from '@standard-schema/spec';
import type { FieldError, FieldErrorCode } from '@trybun/contracts/problem-details';

type IssueDetails = { code?: string; origin?: string };

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

/** Field error code `<kind>.<reason>` (§17.2) of a schema issue. */
export function toFieldErrorCode(issue: StandardSchemaV1.Issue): FieldErrorCode {
  const { code, origin } = issue as StandardSchemaV1.Issue & IssueDetails;
  const size = origin === undefined ? undefined : SIZE_CODES[origin];
  switch (code) {
    case 'too_big':
      return size?.tooBig ?? 'field.invalid';
    case 'too_small':
      return size?.tooSmall ?? 'field.invalid';
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

/** JSON Pointer (RFC 6901) to the field of a schema issue. */
export function toJsonPointer(path: StandardSchemaV1.Issue['path']): string {
  return (path ?? [])
    .map((segment) => (typeof segment === 'object' ? segment.key : segment))
    .map((key) => `/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`)
    .join('');
}

/** The invalid fields of a `422` response (§17.2), one entry per schema issue. */
export function toFieldErrors(issues: readonly StandardSchemaV1.Issue[]): FieldError[] {
  return issues.map((issue) => ({
    pointer: toJsonPointer(issue.path),
    code: toFieldErrorCode(issue),
  }));
}
