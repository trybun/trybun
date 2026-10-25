import { describe, expect, it } from 'vitest';
import { createAdministratorSchema, setupStatusSchema } from './index.js';

describe('setup contracts', () => {
  it('lists the wizard states', () => {
    expect(setupStatusSchema.options).toEqual(['available', 'completed']);
  });

  const valid = {
    token: 'token',
    firstName: '  Ada ',
    lastName: 'Admin',
    email: 'ada@example.com',
    password: 'correct horse battery staple',
    language: 'pl',
    timeZone: 'Europe/Warsaw',
  };

  it('trims the names', () => {
    expect(createAdministratorSchema.parse(valid).firstName).toBe('Ada');
  });

  it.each([
    ['firstName', '   '],
    ['lastName', ''],
    ['email', 'not an e-mail'],
    ['password', 'fourteen chars'],
    ['language', 'de'],
    ['timeZone', 'Nowhere/City'],
  ])('rejects an invalid %s', (field, value) => {
    const result = createAdministratorSchema.safeParse({ ...valid, [field]: value });

    expect(result.error?.issues.map((issue) => issue.path)).toEqual([[field]]);
  });
});
