import { CATALOGUES, type Locale } from '@trybun/i18n/catalogues';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Metadata } from 'next';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

const APP_DIR = import.meta.dirname;
const GENERATE_METADATA = /^export (?:async )?function generateMetadata\(/m;

/** The pages that only redirect, so no tab ever shows their title. */
const REDIRECT_ONLY = [join('(team)', 'projects', '[projectId]', 'page.tsx')];

/** The `page.tsx` files of the App Router, relative to `src/app`. */
function pages(dir = APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return pages(path);
    }
    return entry.name === 'page.tsx' ? [relative(APP_DIR, path)] : [];
  });
}

// Every page names itself in the browser tab (§13.4, WCAG 2.2 SC 2.4.2). The title comes from
// its metadata, never a `<title>` element: Next.js resolves the metadata again after a client-side
// navigation and a language switch, and only the metadata reaches the not-found title when the
// page's read is not found (#404, ADR 0014). The unit test of each page checks what it returns.
describe('the pages of the App Router', () => {
  const titledPages = pages().filter((page) => !REDIRECT_ONLY.includes(page));

  it('are found by the scan', () => {
    expect(titledPages).toContain(join('(team)', 'tickets', '[identifier]', 'page.tsx'));
    expect(titledPages.length).toBeGreaterThanOrEqual(24);
  });

  it.each(titledPages)('%s exports a generateMetadata', (page) => {
    expect(readFileSync(join(APP_DIR, page), 'utf8')).toMatch(GENERATE_METADATA);
  });

  it.each(REDIRECT_ONLY)('%s still only redirects', (page) => {
    const source = readFileSync(join(APP_DIR, page), 'utf8');
    expect(source).toMatch(/\bredirect\(/);
    expect(source).not.toMatch(GENERATE_METADATA);
  });
});

let locale: Locale = 'en';
vi.mock('server-only', () => ({}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: string) =>
    Promise.resolve(
      createTranslator({ locale, messages: CATALOGUES[locale], namespace: namespace as never }),
    ),
}));
// The modules of the pages that read the API or the session at runtime; the titles read neither.
vi.mock('../lib/auth/session.js', () => ({ requireSession: vi.fn() }));
vi.mock('../lib/api-client/server-api-client.js', () => ({}));
vi.mock('../lib/query-client/server-query-client.js', () => ({}));
vi.mock('../lib/env/env.js', () => ({}));

/** The pages whose title is their heading: their path, the title in English and in Polish. */
const STATIC_PAGES: [
  string,
  () => Promise<{ generateMetadata: () => Promise<Metadata> }>,
  string,
  string,
][] = [
  ['(team)/page.tsx', () => import('./(team)/page.js'), 'Home – Trybun', 'Strona główna – Trybun'],
  [
    '(team)/tickets/page.tsx',
    () => import('./(team)/tickets/page.js'),
    'Tickets – Trybun',
    'Zgłoszenia – Trybun',
  ],
  [
    '(team)/tickets/new/page.tsx',
    () => import('./(team)/tickets/new/page.js'),
    'New ticket – Trybun',
    'Nowe zgłoszenie – Trybun',
  ],
  [
    '(team)/projects/page.tsx',
    () => import('./(team)/projects/page.js'),
    'Projects – Trybun',
    'Projekty – Trybun',
  ],
  [
    '(team)/settings/page.tsx',
    () => import('./(team)/settings/page.js'),
    `${CATALOGUES.en.users.settings.title} – Trybun`,
    `${CATALOGUES.pl.users.settings.title} – Trybun`,
  ],
  [
    '(portal)/portal/settings/page.tsx',
    () => import('./(portal)/portal/settings/page.js'),
    `${CATALOGUES.en.users.settings.title} – Trybun`,
    `${CATALOGUES.pl.users.settings.title} – Trybun`,
  ],
  [
    '(portal)/portal/page.tsx',
    () => import('./(portal)/portal/page.js'),
    'Your projects – Trybun',
    'Twoje projekty – Trybun',
  ],
  [
    '(portal)/portal/tickets/page.tsx',
    () => import('./(portal)/portal/tickets/page.js'),
    'My tickets – Trybun',
    'Moje zgłoszenia – Trybun',
  ],
  ['help/page.tsx', () => import('./help/page.js'), 'Help – Trybun', 'Pomoc – Trybun'],
  [
    'invitations/page.tsx',
    () => import('./invitations/page.js'),
    'Accept the invitation – Trybun',
    'Przyjmij zaproszenie – Trybun',
  ],
  ['setup/page.tsx', () => import('./setup/page.js'), 'Setup – Trybun', 'Konfiguracja – Trybun'],
  ['sign-in/page.tsx', () => import('./sign-in/page.js'), 'Sign in – Trybun', 'Logowanie – Trybun'],
];

afterEach(() => {
  locale = 'en';
});

describe.each(STATIC_PAGES)('the tab title of %s', (_, load, english, polish) => {
  it.each([
    ['en', english],
    ['pl', polish],
  ] as const)('is its heading followed by the brand (%s)', async (language, title) => {
    locale = language;
    const { generateMetadata } = await load();

    await expect(generateMetadata()).resolves.toEqual({ title: { absolute: title } });
  });
});
