import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toFieldErrorCode, toJsonPointer, toFieldErrors } from './validation-errors.js';

function issuesOf(schema: z.ZodType, value: unknown): readonly StandardSchemaV1.Issue[] {
  const result = schema['~standard'].validate(value) as StandardSchemaV1.Result<unknown>;
  return result.issues ?? [];
}

describe('toFieldErrorCode', () => {
  it.each([
    [z.string().max(2), 'abc', 'string.too_long'],
    [z.string().min(2), 'a', 'string.too_short'],
    [z.array(z.string()).max(1), ['a', 'b'], 'array.too_long'],
    [z.number().max(1), 2, 'number.too_large'],
    [z.number().min(1), 0, 'number.too_small'],
    [z.date().max(new Date('2026-01-01')), new Date('2026-02-01'), 'date.too_late'],
    [z.string(), 1, 'field.invalid_type'],
    [z.email(), 'x', 'string.invalid_format'],
    [z.enum(['new', 'closed']), 'open', 'field.invalid_value'],
    [z.strictObject({}), { extra: 1 }, 'field.unrecognized'],
    [z.string().refine(() => false), 'a', 'field.invalid'],
  ])('maps an issue of %s for %j to %s', (schema, value, code) => {
    const [issue] = issuesOf(schema, value);
    expect(issue && toFieldErrorCode(issue)).toBe(code);
  });
});

describe('toJsonPointer', () => {
  it.each([
    [undefined, ''],
    [['title'], '/title'],
    [['labels', 0, 'name'], '/labels/0/name'],
    [[{ key: 'a/b~c' }], '/a~1b~0c'],
  ])('turns %j into %j', (path, pointer) => {
    expect(toJsonPointer(path)).toBe(pointer);
  });
});

describe('toFieldErrors', () => {
  it('lists every invalid field', () => {
    const issues = issuesOf(z.object({ title: z.string(), priority: z.number() }), {});

    expect(toFieldErrors(issues)).toEqual([
      { pointer: '/title', code: 'field.invalid_type' },
      { pointer: '/priority', code: 'field.invalid_type' },
    ]);
  });
});
