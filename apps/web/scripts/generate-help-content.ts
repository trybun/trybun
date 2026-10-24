// Generates the help content of the web application from the user documentation in `docs/user`
// (§2.3, §14.2): the pages with their views, and one MiniSearch index per language and account
// kind. `--check` only compares the generated files with the documentation and fails when they
// differ (`pnpm lint`).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import type { Node, Parent, Root } from 'mdast';
import MiniSearch from 'minisearch';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';
import {
  AUDIENCES_OF_KIND,
  HELP_AUDIENCES,
  HELP_CATEGORIES,
  type HelpAudience,
  type HelpCategory,
} from '../src/features/help/audiences.ts';
import { HELP_SEARCH_OPTIONS } from '../src/features/help/search-options.ts';

const ROOT = join(import.meta.dirname, '../../..');
export const DOCS_DIR = join(ROOT, 'docs/user');
const MESSAGES_DIR = join(ROOT, 'packages/i18n/messages');
export const CONTENT_DIR = join(import.meta.dirname, '../src/features/help/content');

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;

const frontMatterSchema = z.strictObject({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  views: z.array(z.string().regex(/^\/[^?#]*$/)).default([]),
});

export interface HelpPage {
  /** `<audience>/<category>/<name>`: the address of the page under `/help`, in every language. */
  slug: string;
  audience: HelpAudience;
  category: HelpCategory;
  title: string;
  description: string;
  /** The routes of the application whose contextual help the page is. */
  views: string[];
  /** The Markdown body without the front matter. */
  body: string;
}

/** The text of a Markdown tree, with the blocks and inline elements separated by spaces. */
function plainText(node: Node): string {
  if ('value' in node && node.type !== 'yaml' && node.type !== 'html') {
    return String(node.value);
  }
  if ('children' in node) {
    return (node as Parent).children.map(plainText).join(' ');
  }
  return '';
}

/**
 * A page of the documentation: front matter and body of its Markdown source.
 * @param path the path relative to the language folder, e.g. `end-user/how-to/change-language.md`
 */
export function parsePage(path: string, source: string): { page: HelpPage; text: string } {
  const [audience, category, name, ...rest] = path.split('/');
  if (!HELP_AUDIENCES.includes(audience as HelpAudience)) {
    throw new Error(`${path}: unknown audience; use one of ${HELP_AUDIENCES.join(', ')}`);
  }
  if (!HELP_CATEGORIES.includes(category as HelpCategory)) {
    throw new Error(`${path}: unknown category; use one of ${HELP_CATEGORIES.join(', ')}`);
  }
  if (name === undefined || rest.length > 0 || !NAME.test(name)) {
    throw new Error(`${path}: a page is <audience>/<category>/<kebab-case-name>.md`);
  }
  const tree: Root = unified().use(remarkParse).use(remarkGfm).use(remarkFrontmatter).parse(source);
  const [first] = tree.children;
  if (first?.type !== 'yaml' || first.position === undefined) {
    throw new Error(`${path}: the page starts with a front matter`);
  }
  const frontMatter = frontMatterSchema.safeParse(parseYaml(first.value));
  if (!frontMatter.success) {
    throw new Error(`${path}: invalid front matter: ${z.prettifyError(frontMatter.error)}`);
  }
  if (tree.children.some((node) => node.type === 'heading' && node.depth === 1)) {
    throw new Error(`${path}: the title comes from the front matter; use no level-1 heading`);
  }
  const { title, description, views } = frontMatter.data;
  return {
    page: {
      slug: path.slice(0, -'.md'.length),
      audience: audience as HelpAudience,
      category: category as HelpCategory,
      title,
      description,
      views,
      body: source.slice(first.position.end.offset).trim(),
    },
    text: plainText({ type: 'root', children: tree.children.slice(1) } as Root),
  };
}

/** The paths of the Markdown files of a folder and its subfolders, relative to it, sorted. */
function markdownFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
    .sort();
}

/**
 * The view map of every account kind: route → slug of the page of the most specific audience
 * the kind receives (§2.3).
 */
export function viewsOfKinds(pages: readonly HelpPage[]): Record<string, Record<string, string>> {
  const claimed = new Map<string, string>();
  for (const page of pages) {
    for (const view of page.views) {
      const key = `${page.audience} ${view}`;
      const other = claimed.get(key);
      if (other !== undefined) {
        throw new Error(`${page.slug}: the view ${view} is already the help of ${other}`);
      }
      claimed.set(key, page.slug);
    }
  }
  return Object.fromEntries(
    Object.entries(AUDIENCES_OF_KIND).map(([kind, audiences]) => {
      const views: Record<string, string> = {};
      for (const audience of audiences) {
        for (const page of pages.filter((candidate) => candidate.audience === audience)) {
          for (const view of page.views) {
            views[view] = page.slug;
          }
        }
      }
      return [kind, Object.fromEntries(Object.entries(views).sort())];
    }),
  );
}

/**
 * The generated files by name: `help-content.json` with the pages of every language and the view
 * maps, `search-indexes.json` with the MiniSearch index of every language and account kind.
 * @param documentation the Markdown sources by language and path within the language folder
 */
export function renderHelpContent(
  documentation: Readonly<Record<string, Readonly<Record<string, string>>>>,
): Map<string, string> {
  const locales = Object.keys(documentation).sort();
  const [reference] = locales;
  if (reference === undefined) {
    throw new Error('The documentation has no language');
  }
  const pages: Record<string, HelpPage[]> = {};
  const indexes: Record<string, Record<string, unknown>> = {};
  for (const locale of locales) {
    const parsed = Object.entries(documentation[locale] ?? {})
      .map(([path, source]) => parsePage(path, source))
      .sort((a, b) => a.page.slug.localeCompare(b.page.slug));
    pages[locale] = parsed.map(({ page }) => page);
    indexes[locale] = Object.fromEntries(
      Object.entries(AUDIENCES_OF_KIND).map(([kind, audiences]) => {
        const index = new MiniSearch(HELP_SEARCH_OPTIONS);
        index.addAll(
          parsed
            .filter(({ page }) => audiences.includes(page.audience))
            .map(({ page: { slug, title, description }, text }) => ({
              slug,
              title,
              description,
              text,
            })),
        );
        return [kind, index.toJSON()];
      }),
    );
  }
  const referencePages = pages[reference] ?? [];
  for (const locale of locales) {
    const localePages = pages[locale] ?? [];
    const slugs = new Set(localePages.map((page) => page.slug));
    for (const page of referencePages) {
      if (!slugs.has(page.slug)) {
        throw new Error(
          `${locale}/${page.slug}.md is missing: every page exists in every language`,
        );
      }
    }
    for (const page of localePages) {
      const original = referencePages.find((candidate) => candidate.slug === page.slug);
      if (original === undefined) {
        throw new Error(
          `${reference}/${page.slug}.md is missing: every page exists in every language`,
        );
      }
      if (JSON.stringify(original.views) !== JSON.stringify(page.views)) {
        throw new Error(`${locale}/${page.slug}.md: the views differ from ${reference}`);
      }
    }
  }
  const content = { pages, views: viewsOfKinds(referencePages) };
  return new Map([
    ['help-content.json', `${JSON.stringify(content, null, 2)}\n`],
    ['search-indexes.json', `${JSON.stringify(indexes)}\n`],
  ]);
}

/** The documentation by language: one folder for each language of the message catalogues. */
export function readDocumentation(
  docsDir = DOCS_DIR,
  messagesDir = MESSAGES_DIR,
): Record<string, Record<string, string>> {
  const locales = readdirSync(messagesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => file.slice(0, -'.json'.length))
    .sort();
  return Object.fromEntries(
    locales.map((locale) => {
      const dir = join(docsDir, locale);
      return [
        locale,
        Object.fromEntries(
          markdownFiles(dir).map((path) => [path, readFileSync(join(dir, path), 'utf8')]),
        ),
      ];
    }),
  );
}

function main() {
  const files = renderHelpContent(readDocumentation());
  if (process.argv.includes('--check')) {
    const stale = [...files.keys()].filter((name) => {
      try {
        return readFileSync(join(CONTENT_DIR, name), 'utf8') !== files.get(name);
      } catch {
        return true;
      }
    });
    if (stale.length > 0) {
      const paths = stale.map((name) => `  ${relative(ROOT, join(CONTENT_DIR, name))}`);
      process.stderr.write(
        ['The help content is out of date; run `pnpm help:generate`:', ...paths, ''].join('\n'),
      );
      process.exit(1);
    }
    return;
  }
  mkdirSync(CONTENT_DIR, { recursive: true });
  for (const [name, content] of files) {
    writeFileSync(join(CONTENT_DIR, name), content);
  }
}

if (process.argv[1] === import.meta.filename) {
  main();
}
