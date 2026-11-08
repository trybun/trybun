import { describe, expect, it } from 'vitest';
import { teamRolesFrom } from './project-roles.js';

describe('teamRolesFrom', () => {
  it.each([
    ['developer', ['developer', 'project_manager']],
    ['project_manager', ['project_manager']],
  ] as const)('a rule of %s is held by %o', (lowest, roles) => {
    expect(teamRolesFrom(lowest)).toEqual(roles);
  });
});
