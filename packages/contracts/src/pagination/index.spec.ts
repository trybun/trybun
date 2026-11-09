import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { pageQuerySchema, pageSchema } from './index.js';

describe('pageSchema', () => {
  const page = pageSchema(z.object({ id: z.string() }));

  it.each([
    [{ items: [{ id: 'a' }], nextCursor: 'b' }, true],
    [{ items: [], nextCursor: null }, true],
    [{ items: [{ id: 1 }], nextCursor: null }, false],
    [{ items: [] }, false],
  ])('accepts %j: %s', (input, isValid) => {
    expect(page.safeParse(input).success).toBe(isValid);
  });
});

describe('pageQuerySchema', () => {
  it.each([
    [{}, { limit: 50 }],
    [
      { limit: '20', cursor: 'abc' },
      { limit: 20, cursor: 'abc' },
    ],
  ])('parses %j', (input, output) => {
    expect(pageQuerySchema.parse(input)).toEqual(output);
  });

  it.each([[{ limit: '0' }], [{ limit: '101' }], [{ limit: '1.5' }], [{ cursor: '' }]])(
    'rejects %j',
    (input) => {
      expect(pageQuerySchema.safeParse(input).success).toBe(false);
    },
  );
});
