'use client';

import { Input } from '@trybun/ui/components/input';
import MiniSearch, { type AsPlainObject } from 'minisearch';
import { useTranslations } from 'next-intl';
import { type ReactNode, useId, useState } from 'react';
import { HELP_SEARCH_OPTIONS, type HelpSearchDocument } from '../search-options.js';
import { HelpTopicLink } from './help-topic-link.js';

/**
 * The search of the help (§2.3) in the MiniSearch index of the reader's pages, built at build time
 * for the language and the account kind (§14.2). The query stays in the component and never goes
 * into the URL (§17.2); without one, the list of all topics is shown.
 */
export function HelpSearch({ index, children }: { index: AsPlainObject; children: ReactNode }) {
  const t = useTranslations('help');
  const inputId = useId();
  // Loaded again only for another index, e.g. after switching the language (React Compiler).
  const search = MiniSearch.loadJS<HelpSearchDocument>(index, HELP_SEARCH_OPTIONS);
  const [query, setQuery] = useState('');
  const isSearching = query.trim() !== '';
  // The stored fields of a result are its title and description (`storeFields`).
  const results = isSearching
    ? search.search(query).map((result) => ({
        slug: String(result.id),
        title: String(result.title),
        description: String(result.description),
      }))
    : [];
  return (
    <div className="flex flex-col gap-6">
      <search className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {t('search')}
        </label>
        <Input
          id={inputId}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </search>
      <p aria-live="polite" className={isSearching ? 'text-sm text-muted-foreground' : 'sr-only'}>
        {isSearching ? t('results', { count: results.length }) : ''}
      </p>
      {isSearching ? (
        <ul className="flex flex-col gap-2">
          {results.map((result) => (
            <li key={result.slug}>
              <HelpTopicLink {...result} />
            </li>
          ))}
        </ul>
      ) : (
        children
      )}
    </div>
  );
}
