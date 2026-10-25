import type { StandardSchemaV1 } from '@standard-schema/spec';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toJsonPointer, toFieldErrors } from './validation-errors.js';

function issuesOf(schema: z.ZodType, value: unknown): readonly StandardSchemaV1.Issue[] {
  const result = schema['~standard'].validate(value) as StandardSchemaV1.Result<unknown>;
  return result.issues ?? [];
}

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
