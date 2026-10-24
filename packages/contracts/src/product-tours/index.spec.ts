import { describe, expect, it } from 'vitest';
import {
  productTourIdSchema,
  productTourStatusSchema,
  recordProductTourProgressSchema,
} from './index.js';

describe('product tour enums', () => {
  it.each([
    [productTourIdSchema, ['first_login']],
    [productTourStatusSchema, ['completed', 'skipped']],
  ])('lists the glossary codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('recordProductTourProgressSchema', () => {
  it.each([
    [{ tourVersion: 1, status: 'completed' }, true],
    [{ tourVersion: 3, status: 'skipped' }, true],
    [{ tourVersion: 0, status: 'completed' }, false],
    [{ tourVersion: 1.5, status: 'completed' }, false],
    [{ tourVersion: 1, status: 'started' }, false],
    [{ status: 'completed' }, false],
  ])('accepts %j: %s', (input, isValid) => {
    expect(recordProductTourProgressSchema.safeParse(input).success).toBe(isValid);
  });
});
