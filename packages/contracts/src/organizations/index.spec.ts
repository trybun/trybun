import { describe, expect, it } from 'vitest';
import {
  addOrganizationMemberSchema,
  createOrganizationSchema,
  listOrganizationsQuerySchema,
  organizationActionSchema,
  organizationStateSchema,
  updateOrganizationSchema,
} from './index.js';

describe('organization enums', () => {
  it.each([
    [organizationStateSchema, ['active', 'archived']],
    [
      organizationActionSchema,
      ['read', 'update', 'archive', 'unarchive', 'delete', 'manage_projects', 'manage_members'],
    ],
  ])('lists the codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('createOrganizationSchema', () => {
  it('trims the name and defaults to no domains', () => {
    expect(createOrganizationSchema.parse({ name: '  Acme  ' })).toEqual({
      name: 'Acme',
      domains: [],
    });
  });

  it.each([
    ['', false],
    ['   ', false],
    ['A', true],
    ['A'.repeat(100), true],
    ['A'.repeat(101), false],
  ])('name %j is valid: %s', (name, isValid) => {
    expect(createOrganizationSchema.safeParse({ name }).success).toBe(isValid);
  });

  it('trims the domains', () => {
    expect(createOrganizationSchema.parse({ name: 'Acme', domains: [' acme.com '] }).domains).toEqual(
      ['acme.com'],
    );
  });
});

describe('updateOrganizationSchema', () => {
  it('needs at least one field', () => {
    expect(updateOrganizationSchema.safeParse({}).success).toBe(false);
  });

  it.each([{ name: 'Acme' }, { domains: [] }, { projectIds: [] }])('accepts %j', (input) => {
    expect(updateOrganizationSchema.safeParse(input).success).toBe(true);
  });

  it('rejects a project ID that is not a UUID', () => {
    expect(updateOrganizationSchema.safeParse({ projectIds: ['ERP'] }).success).toBe(false);
  });
});

describe('listOrganizationsQuerySchema', () => {
  it('lists active organizations by default', () => {
    expect(listOrganizationsQuerySchema.parse({}).state).toBe('active');
  });
});

describe('addOrganizationMemberSchema', () => {
  it('does not move by default', () => {
    expect(addOrganizationMemberSchema.parse({ email: 'anna@acme.com' })).toEqual({
      email: 'anna@acme.com',
      move: false,
    });
  });

  it('rejects an address that is not an e-mail address', () => {
    expect(addOrganizationMemberSchema.safeParse({ email: 'anna' }).success).toBe(false);
  });
});
