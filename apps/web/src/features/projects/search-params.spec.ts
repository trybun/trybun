import { describe, expect, it } from 'vitest';
import {
  projectSettingsHref,
  projectSettingsSearchParamsSchema,
  projectsSearchParamsSchema,
} from './search-params.js';

describe('projects search params', () => {
  it.each([
    [{}, 'active'],
    [{ state: 'archived' }, 'archived'],
    [{ state: 'deleted' }, 'active'],
    [{ state: ['archived', 'active'] }, 'active'],
  ])('reads %j as the %s tab', (params, state) => {
    expect(projectsSearchParamsSchema.parse(params)).toEqual({ state });
  });

  it.each([
    [{}, 'general'],
    [{ tab: 'members' }, 'members'],
    [{ tab: 'other' }, 'general'],
  ])('reads the settings tab of %j as %s', (params, tab) => {
    expect(projectSettingsSearchParamsSchema.parse(params)).toEqual({ tab });
  });

  it.each([
    [undefined, '/projects/p1/settings'],
    ['general', '/projects/p1/settings'],
    ['members', '/projects/p1/settings?tab=members'],
  ] as const)('links the %s tab', (tab, href) => {
    expect(projectSettingsHref('p1', tab)).toBe(href);
  });
});
