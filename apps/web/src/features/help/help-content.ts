import 'server-only';
import type { UserKind } from '@trybun/contracts/users';
import type { Locale } from '@trybun/i18n/catalogues';
import type { AsPlainObject } from 'minisearch';
import { z } from 'zod';
import { AUDIENCES_OF_KIND, HELP_AUDIENCES, HELP_CATEGORIES } from './audiences.js';
import content from './content/help-content.json' with { type: 'json' };
import searchIndexes from './content/search-indexes.json' with { type: 'json' };

// The help content generated from `docs/user` by `pnpm help:generate` (§2.3). It is the same for
// every reader of an account kind and a language, so it is read once per process (§18.5).

const helpPageSchema = z.object({
  slug: z.string(),
  audience: z.enum(HELP_AUDIENCES),
  category: z.enum(HELP_CATEGORIES),
  title: z.string(),
  description: z.string(),
  views: z.array(z.string()),
  body: z.string(),
});
export type HelpPage = z.infer<typeof helpPageSchema>;

const helpContentSchema = z.object({
  pages: z.record(z.string(), z.array(helpPageSchema)),
  views: z.record(z.string(), z.record(z.string(), z.string())),
});

const searchIndexesSchema = z.record(
  z.string(),
  z.record(
    z.string(),
    z.custom<AsPlainObject>((value) => typeof value === 'object' && value !== null),
  ),
);

const HELP_CONTENT = helpContentSchema.parse(content);
const SEARCH_INDEXES = searchIndexesSchema.parse(searchIndexes);

/** The help pages a reader of an account kind receives in a language, ordered by address. */
export function getHelpPages(locale: Locale, kind: UserKind): HelpPage[] {
  const audiences = AUDIENCES_OF_KIND[kind];
  return (HELP_CONTENT.pages[locale] ?? []).filter((page) => audiences.includes(page.audience));
}

/**
 * A help page by its address; `undefined` when it does not exist or is not written for the
 * reader, so a page of another audience is not found, like an invisible record (§14.4).
 */
export function getHelpPage(locale: Locale, kind: UserKind, slug: string): HelpPage | undefined {
  return getHelpPages(locale, kind).find((page) => page.slug === slug);
}

/** The contextual help of a reader: route of a view → address of its help page (§2.3). */
export function getHelpViews(kind: UserKind): Readonly<Record<string, string>> {
  return HELP_CONTENT.views[kind] ?? {};
}

/** The MiniSearch index of the pages a reader receives in a language (§14.2). */
export function getHelpSearchIndex(locale: Locale, kind: UserKind): AsPlainObject {
  const index = SEARCH_INDEXES[locale]?.[kind];
  if (index === undefined) {
    throw new Error(`The help has no search index for ${locale} and ${kind}`);
  }
  return index;
}
