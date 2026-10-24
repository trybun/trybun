import MiniSearch from 'minisearch';
import { describe, expect, it, vi } from 'vitest';
import { HELP_SEARCH_OPTIONS } from './search-options.js';

vi.mock('server-only', () => ({}));

const { getHelpPage, getHelpPages, getHelpSearchIndex, getHelpViews } =
  await import('./help-content.js');

const TEAM_PAGE = 'team/tutorials/getting-started';

describe('help content', () => {
  it.each(['en', 'pl'] as const)('gives an end user only the end-user pages (%s)', (locale) => {
    const pages = getHelpPages(locale, 'end_user');

    expect(pages.length).toBeGreaterThan(0);
    expect(pages.every((page) => page.audience === 'end-user')).toBe(true);
    expect(getHelpPage(locale, 'end_user', TEAM_PAGE)).toBeUndefined();
  });

  it.each(['en', 'pl'] as const)('gives the team the pages of every audience (%s)', (locale) => {
    const audiences = new Set(getHelpPages(locale, 'team').map((page) => page.audience));

    expect(audiences).toEqual(new Set(['end-user', 'team']));
    expect(getHelpPage(locale, 'team', TEAM_PAGE)?.audience).toBe('team');
  });

  it('opens the help of the most specific audience of the reader for a view', () => {
    expect(getHelpViews('end_user')['/']).toBe('end-user/tutorials/getting-started');
    expect(getHelpViews('team')['/']).toBe(TEAM_PAGE);
  });

  it.each([
    ['en', 'end_user', 'initials', 'end-user/tutorials/getting-started'],
    ['pl', 'end_user', 'inicjały', 'end-user/tutorials/getting-started'],
    ['pl', 'end_user', 'jezyk', 'end-user/how-to/change-language'],
    ['en', 'team', 'authenticator', TEAM_PAGE],
    ['pl', 'team', 'uwierzytelniającej', TEAM_PAGE],
  ] as const)('finds a page by a word in its body (%s, %s: %s)', (locale, kind, query, slug) => {
    const search = MiniSearch.loadJS(getHelpSearchIndex(locale, kind), HELP_SEARCH_OPTIONS);

    expect(search.search(query).map((result) => String(result.id))).toContain(slug);
  });

  it.each(['en', 'pl'] as const)('never finds a team page for an end user (%s)', (locale) => {
    const search = MiniSearch.loadJS(getHelpSearchIndex(locale, 'end_user'), HELP_SEARCH_OPTIONS);
    const teamPages = getHelpPages(locale, 'team').filter((page) => page.audience !== 'end-user');

    for (const page of teamPages) {
      expect(
        search.search(page.title, { combineWith: 'OR' }).map((result) => String(result.id)),
      ).not.toContain(page.slug);
    }
    expect(search.documentCount).toBe(getHelpPages(locale, 'end_user').length);
  });
});
