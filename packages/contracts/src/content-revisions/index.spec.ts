import { describe, expect, it } from 'vitest';
import { redactDescriptionSchema } from './index.js';

describe('redactDescriptionSchema', () => {
  it('accepts an empty description, which redacts the whole text', () => {
    expect(redactDescriptionSchema.parse({ description: '', purgeRevisionIds: [] })).toEqual({
      description: '',
      purgeRevisionIds: [],
    });
  });

  it('refuses unknown fields', () => {
    expect(
      redactDescriptionSchema.safeParse({ description: '', purgeRevisionIds: [], body: 'x' })
        .success,
    ).toBe(false);
  });
});
