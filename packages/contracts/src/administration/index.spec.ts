import { describe, expect, it } from 'vitest';
import { administrationActionSchema, gettingStartedItemIdSchema } from './index.js';

describe('administration enums', () => {
  it.each([
    [administrationActionSchema, ['read']],
    [
      gettingStartedItemIdSchema,
      [
        'create_project',
        'configure_github_sign_in',
        'create_organization',
        'configure_email',
        'configure_backup_storage',
      ],
    ],
  ])('lists the glossary codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});
