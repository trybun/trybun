import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_DIR = import.meta.dirname;

/**
 * The calls through which a page shows the not-found page: `notFound()` itself and the shared
 * reads that call it (§18.5).
 */
const NOT_FOUND_READ =
  /\b(?:notFound|dataOrNotFound|getTicketPage|getPortalProject|loadPortalProject|getAdministrator)\(/;
const GENERATE_METADATA = /^export (?:async )?function generateMetadata\(/m;

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

// Next.js serves the metadata of a `not-found.tsx` only when the metadata itself hits the
// not-found: a page that calls it only while rendering keeps the title of its layouts, untranslated
// after a client-side navigation or a language switch (#404, ADR 0014).
describe('pages that can show the not-found page', () => {
  const notFoundPages = pages().filter((page) =>
    NOT_FOUND_READ.test(readFileSync(join(APP_DIR, page), 'utf8')),
  );

  it('are found by the scan', () => {
    expect(notFoundPages).toContain(join('(team)', 'tickets', '[identifier]', 'page.tsx'));
    expect(notFoundPages.length).toBeGreaterThanOrEqual(12);
  });

  it.each(notFoundPages)('%s performs its read in generateMetadata too', (page) => {
    expect(readFileSync(join(APP_DIR, page), 'utf8')).toMatch(GENERATE_METADATA);
  });
});
