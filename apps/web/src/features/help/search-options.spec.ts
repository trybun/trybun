import MiniSearch from 'minisearch';
import { describe, expect, it } from 'vitest';
import { HELP_SEARCH_OPTIONS, normalizeTerm } from './search-options.js';

describe('normalizeTerm', () => {
  it.each([
    ['Język', 'jezyk'],
    ['ZAŻÓŁĆ', 'zazolc'],
    ['gęślą', 'gesla'],
    ['Language', 'language'],
  ])('%s → %s', (term, expected) => {
    expect(normalizeTerm(term)).toBe(expected);
  });
});

describe('HELP_SEARCH_OPTIONS', () => {
  const search = new MiniSearch(HELP_SEARCH_OPTIONS);
  search.addAll([
    {
      slug: 'a',
      title: 'Zmień język',
      description: 'Przełącz interfejs.',
      text: 'Wybierz menu konta.',
    },
    {
      slug: 'b',
      title: 'Wyloguj się',
      description: 'Zakończ sesję.',
      text: 'Wybierz Wyloguj się.',
    },
  ]);

  it.each([
    ['jezyk', ['a']],
    ['menu konta', ['a']],
    ['wylog', ['b']],
    ['interfejs sesja', []],
  ])('%s finds %j', (query, expected) => {
    expect(search.search(query).map((result) => String(result.id))).toEqual(expected);
  });
});
