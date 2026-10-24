import type { Options } from 'minisearch';

/** A searchable help page: the address of the page and its text (§2.3). */
export interface HelpSearchDocument {
  slug: string;
  title: string;
  description: string;
  text: string;
}

/**
 * A word as it is indexed and searched: lower case, without diacritics, so `jezyk` finds
 * `język`. `ł` has no decomposition and is replaced on its own.
 */
export function normalizeTerm(term: string): string {
  return term
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .replaceAll(/ł/giu, 'l')
    .toLowerCase();
}

/**
 * The MiniSearch options of the help search (§14.2), shared by the generator of the indexes and
 * the search in the browser, which must process words the same way.
 */
export const HELP_SEARCH_OPTIONS = {
  idField: 'slug',
  fields: ['title', 'description', 'text'],
  storeFields: ['title', 'description'],
  processTerm: normalizeTerm,
  searchOptions: {
    boost: { title: 3, description: 2 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND',
  },
} satisfies Options<HelpSearchDocument>;
