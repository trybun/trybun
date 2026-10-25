import { describe, expect, it } from 'vitest';
import { administrationActionSchema, gettingStartedItemIdSchema } from './index.js';

describe('administration enums', () => {
  it.each([
    [administrationActionSchema, ['read']],
    [gettingStartedItemIdSchema, ['configure_github_sign_in', 'configure_email']],
  ])('lists the glossary codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});
