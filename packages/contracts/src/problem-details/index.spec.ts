import { describe, expect, it } from 'vitest';
import { problemDetailsSchema } from './index.js';

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
