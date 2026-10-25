import type { StandardSchemaV1 } from '@standard-schema/spec';
import { type FieldError, toFieldErrorCode } from '@trybun/contracts/problem-details';

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
