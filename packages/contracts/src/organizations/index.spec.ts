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
    expect(
      createOrganizationSchema.parse({ name: 'Acme', domains: [' acme.com '] }).domains,
    ).toEqual(['acme.com']);
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
  const id = '0190a7e4-3c1e-7a00-8000-000000000001';

  it('lists active organizations by default', () => {
    expect(listOrganizationsQuerySchema.parse({})).toEqual({ state: 'active', limit: 50 });
  });

  it('searches organizations by a trimmed text and ignores a blank one', () => {
    expect(listOrganizationsQuerySchema.parse({ query: ' acme ' }).query).toBe('acme');
    expect(listOrganizationsQuerySchema.parse({ query: '' }).query).toBeUndefined();
  });

  it('reads one or more organization IDs and rejects more than 50', () => {
    expect(listOrganizationsQuerySchema.parse({ id }).id).toEqual([id]);
    expect(listOrganizationsQuerySchema.parse({ id: [id, id] }).id).toEqual([id, id]);
    expect(listOrganizationsQuerySchema.safeParse({ id: Array<string>(51).fill(id) }).success).toBe(
      false,
    );
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
