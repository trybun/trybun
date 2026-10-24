import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { pageSchema } from './index.js';

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
