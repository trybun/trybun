import { describe, expect, it } from 'vitest';
import {
  createProjectSchema,
  listMemberCandidatesQuerySchema,
  listProjectMembersQuerySchema,
  listProjectsQuerySchema,
  projectActionSchema,
  projectResponseSchema,
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
        'create_ticket',
        'assign_tickets',
        'assign_tickets_self',
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

describe('listProjectMembersQuerySchema', () => {
  it.each([
    ['true', true],
    ['false', false],
  ])('reads assignable=%s as %s', (assignable, expected) => {
    expect(listProjectMembersQuerySchema.parse({ assignable }).assignable).toBe(expected);
  });

  it('rejects an assignable that is not a boolean', () => {
    expect(listProjectMembersQuerySchema.safeParse({ assignable: 'maybe' }).success).toBe(false);
  });

  it('trims the search text of the assignee picker (Q9)', () => {
    expect(listProjectMembersQuerySchema.parse({ query: ' anna ' })).toMatchObject({
      query: 'anna',
    });
  });
});

describe('projectResponseSchema', () => {
  const endUserProject = {
    id: '0190f2f4-7c1e-7000-8000-000000000001',
    name: 'ERP system',
    key: 'ERP',
    state: 'active',
    allowedActions: ['read', 'create_ticket'],
  };

  it("keeps the team's fields of a team project", () => {
    const project = {
      ...endUserProject,
      confirmResolution: true,
      version: 3,
      createdAt: '2026-11-04T10:00:00.000Z',
      updatedAt: '2026-11-04T10:00:00.000Z',
      role: 'developer',
      hasTickets: false,
    };

    expect(projectResponseSchema.parse(project)).toEqual(project);
  });

  it("strips every field outside the end user's shape", () => {
    expect(
      projectResponseSchema.parse({ ...endUserProject, confirmResolution: true, role: 'end_user' }),
    ).toEqual(endUserProject);
  });
});
