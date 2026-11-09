import { describe, expect, it } from 'vitest';
import { creationDefaults, initialStatusOf, sourceOf } from './creation.js';

describe('the creation of a ticket', () => {
  it.each([
    ['user', 'new'],
    ['integration', 'new'],
    ['developer', 'todo'],
  ] as const)('starts a ticket from the source %s in %s (§4.3)', (source, status) => {
    expect(initialStatusOf(source)).toBe(status);
  });

  it.each([
    ['end_user', 'user'],
    ['team', 'developer'],
  ] as const)('takes the source of a %s account as %s', (kind, source) => {
    expect(sourceOf(kind)).toBe(source);
  });

  it.each([
    [
      'an end user',
      'end_user',
      {},
      { source: 'user', status: 'new', type: null, priority: 'normal' },
    ],
    [
      'the team, without type',
      'team',
      {},
      { source: 'developer', status: 'todo', type: 'task', priority: 'normal' },
    ],
    [
      'the team, with type and priority',
      'team',
      { type: 'bug', priority: 'critical' },
      { source: 'developer', status: 'todo', type: 'bug', priority: 'critical' },
    ],
  ] as const)('completes the fields of %s', (_case, kind, input, defaults) => {
    expect(creationDefaults(kind, input)).toEqual(defaults);
  });
});
