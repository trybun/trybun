import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { problemDetailsSchema, toFieldErrorCode } from './index.js';

const problem = { type: 'about:blank', title: 'Validation failed', status: 422 };

describe('problemDetailsSchema', () => {
  it.each([
    ['without field errors', { ...problem, code: 'request.validation_failed' }],
    [
      'with field errors',
      {
        ...problem,
        code: 'request.validation_failed',
        errors: [{ pointer: '/title', code: 'string.too_long' }],
      },
    ],
  ])('accepts a problem %s', (_case, body) => {
    expect(problemDetailsSchema.parse(body)).toEqual(body);
  });

  it.each([
    ['an unknown error code', { ...problem, code: 'teapot' }],
    [
      'an unknown field error code',
      {
        ...problem,
        code: 'request.validation_failed',
        errors: [{ pointer: '/title', code: 'string.too_shiny' }],
      },
    ],
    ['a fractional status', { ...problem, status: 422.5, code: 'request.validation_failed' }],
  ])('rejects %s', (_case, body) => {
    expect(problemDetailsSchema.safeParse(body).success).toBe(false);
  });
});

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
    const [issue] = schema.safeParse(value).error?.issues ?? [];
    expect(issue && toFieldErrorCode(issue)).toBe(code);
  });
});
