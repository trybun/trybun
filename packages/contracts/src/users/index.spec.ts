import { describe, expect, it } from 'vitest';
import { userKindSchema, userStateSchema } from './index.js';

describe('user enums', () => {
  it.each([
    [userKindSchema, ['team', 'end_user']],
    [userStateSchema, ['invited', 'active', 'deactivated', 'anonymized']],
  ])('lists the glossary codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});
