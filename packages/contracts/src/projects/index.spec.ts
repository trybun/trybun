import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  listMemberCandidatesQuerySchema,
  listProjectsQuerySchema,
  projectActionSchema,
  projectRoleSchema,
  projectStateSchema,
  updateProjectSchema,
} from './index.js';

describe('project enums', () => {
  it.each([
    [projectStateSchema, ['active', 'archived']],
    [projectRoleSchema, ['developer', 'project_manager']],
    [
      projectActionSchema,
      [
        'read',
        'update',
        'update_settings',
        'archive',
        'unarchive',
        'delete',
        'read_members',
        'manage_members',
      ],
    ],
  ])('lists the codes', (schema, codes) => {
    expect(schema.options).toEqual(codes);
  });
});

describe('createProjectSchema', () => {
  it.each([
    ['ERP', true],
    ['E2', true],
    ['ABCDEFGHIJ', true],
    ['erp', false],
    ['1ERP', false],
    ['E', false],
    ['ABCDEFGHIJK', false],
    ['ER-P', false],
  ])('accepts the key %s: %s', (key, isValid) => {
    expect(createProjectSchema.safeParse({ name: 'ERP', key }).success).toBe(isValid);
  });

  it('rejects a key in lower case with the invalid-format code', () => {
    const result = createProjectSchema.safeParse({ name: 'ERP', key: 'erp' });

    expect(result.error?.issues).toMatchObject([{ path: ['key'], code: 'invalid_format' }]);
  });

  it.each([
    ['  ERP system  ', 'ERP system'],
    ['x'.repeat(100), 'x'.repeat(100)],
  ])('trims the name %j', (name, trimmed) => {
    expect(createProjectSchema.parse({ name, key: 'ERP' }).name).toBe(trimmed);
  });

  it.each([[''], ['   '], ['x'.repeat(101)]])('rejects the name %j', (name) => {
    expect(createProjectSchema.safeParse({ name, key: 'ERP' }).success).toBe(false);
  });
});

describe('updateProjectSchema', () => {
  it.each([
    [{ name: 'ERP' }, true],
    [{ confirmResolution: false }, true],
    [{ key: 'ERP', name: 'ERP' }, true],
    [{}, false],
    [{ key: 'erp' }, false],
  ])('accepts %j: %s', (input, isValid) => {
    expect(updateProjectSchema.safeParse(input).success).toBe(isValid);
  });
});

describe('list queries', () => {
  it('lists active projects by default', () => {
    expect(listProjectsQuerySchema.parse({})).toEqual({ state: 'active', limit: 50 });
  });

  it('trims the search text of the member picker', () => {
    expect(listMemberCandidatesQuerySchema.parse({ query: ' anna ' })).toMatchObject({
      query: 'anna',
    });
  });
});
