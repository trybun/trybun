// Checks the first load of the application shell after `next build` (§2.9, §18.5): the JavaScript
// that every first load of a shell layout carries must not contain Zod. The Lighthouse budget
// catches such a regression only on some runs, because the simulated LCP moves in steps between
// runs of one build (#372, #374). Run by the `build` script: `node scripts/check-first-load.ts`.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { z } from 'zod';

/** The layouts of the shell, which render the key pages of the Lighthouse budget (§2.9). */
export const GUARDED_LAYOUTS = ['app/(team)/layout', 'app/(portal)/layout', 'app/help/layout'];

/**
 * The `$constructor` name of `ZodType` (`ZodMiniType` in Zod Mini), which every schema of Zod 4
 * extends, as a quoted literal; minification keeps it. The core's `$ZodType` does not match: the
 * `config` of `zod/v4/core` that `instrumentation-client.ts` imports carries it into every page.
 */
export const ZOD_MARKER = /(["'`])Zod(?:Mini)?Type\1/;

const BUILD_DIR = join(import.meta.dirname, '../.next');

const buildManifestSchema = z.object({ rootMainFiles: z.array(z.string()) });

const clientReferenceManifestsSchema = z.record(
  z.string(),
  z.object({ entryJSFiles: z.record(z.string(), z.array(z.string())) }),
);

/** Files of the entry chunks per module, as `entryJSFiles` of a client reference manifest lists them. */
export type EntryFiles = Record<string, string[]>;

export interface LayoutFirstLoad {
  layout: string;
  chunks: string[];
  gzipBytes: number;
  /** The chunks that contain Zod. */
  zodChunks: string[];
}

/** The `entryJSFiles` of every manifest a `page_client-reference-manifest.js` file assigns. */
export function parseClientReferenceManifest(source: string, file: string): EntryFiles[] {
  // The file is the build's own output, a script assigning `globalThis.__RSC_MANIFEST[…]`. It runs
  // in an empty context of its own; the JSON round trip turns its objects into this context's.
  const context: { __RSC_MANIFEST?: unknown } = {};
  runInNewContext(source, context, { filename: file, timeout: 1000 });
  const parsed = clientReferenceManifestsSchema.safeParse(
    JSON.parse(JSON.stringify(context.__RSC_MANIFEST ?? null)),
  );
  if (!parsed.success) {
    throw new Error(`${file} is not a client reference manifest: ${z.prettifyError(parsed.error)}`);
  }
  return Object.values(parsed.data).map((manifest) => manifest.entryJSFiles);
}

/**
 * The files every page loads: `rootMainFiles` of `build-manifest.json` – the framework, the
 * Turbopack runtime and `instrumentation-client.ts`. Its `polyfillFiles` are left out: Next.js
 * loads them with `noModule`, so the browsers of §2.9 never download them.
 */
export function parseBuildManifest(source: string): string[] {
  return buildManifestSchema.parse(JSON.parse(source)).rootMainFiles;
}

/**
 * The first load of each layout – the files every page loads and the layout's entry chunks in any
 * of the manifests – with its gzip size and the chunks that contain Zod. The check never passes
 * silently: it fails for a layout found in no manifest (a changed build format, a moved layout)
 * and when Zod is in no entry chunk of the build at all, because the pages with a form load it –
 * then the marker no longer identifies Zod.
 */
export function checkFirstLoad({
  layouts,
  rootFiles,
  manifests,
  readChunk,
}: {
  layouts: readonly string[];
  rootFiles: readonly string[];
  manifests: readonly EntryFiles[];
  readChunk: (file: string) => Buffer;
}): LayoutFirstLoad[] {
  const contents = new Map<string, Buffer>();
  const contentOf = (chunk: string) => {
    let content = contents.get(chunk);
    if (content === undefined) {
      content = readChunk(chunk);
      contents.set(chunk, content);
    }
    return content;
  };
  const containsZod = (chunk: string) => ZOD_MARKER.test(contentOf(chunk).toString('utf8'));

  const buildChunks = new Set(manifests.flatMap((manifest) => Object.values(manifest).flat()));
  if (![...buildChunks].some(containsZod)) {
    throw new Error(
      `No entry chunk of the build matches ${String(ZOD_MARKER)}, though the pages with a form ` +
        'load Zod: the marker no longer identifies Zod and needs updating.',
    );
  }

  return layouts.map((layout) => {
    // Turbopack keys a module by its path from the workspace root: `[project]/apps/web/src/app/…`.
    const keySuffix = `/src/${layout}`;
    const entries = manifests.flatMap((manifest) =>
      Object.entries(manifest).filter(([key]) => key.endsWith(keySuffix)),
    );
    if (entries.length === 0) {
      throw new Error(`The layout ${layout} is not in any client reference manifest of the build.`);
    }
    const chunks = [...new Set([...rootFiles, ...entries.flatMap(([, files]) => files)])];
    return {
      layout,
      chunks,
      gzipBytes: chunks.reduce((sum, chunk) => sum + gzipSync(contentOf(chunk)).length, 0),
      zodChunks: chunks.filter(containsZod),
    };
  });
}

function clientReferenceManifestFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('page_client-reference-manifest.js'))
    .map((path) => join(dir, path));
}

/** Reads a chunk the manifests list, by its path relative to the build directory. */
export function chunkReader(buildDir: string): (file: string) => Buffer {
  return (file) => {
    try {
      return readFileSync(join(buildDir, file));
    } catch (error) {
      throw new Error(`The chunk ${file} listed by the build is missing.`, { cause: error });
    }
  };
}

function main() {
  const rootFiles = parseBuildManifest(
    readFileSync(join(BUILD_DIR, 'build-manifest.json'), 'utf8'),
  );
  const manifests = clientReferenceManifestFiles(join(BUILD_DIR, 'server/app')).flatMap((file) =>
    parseClientReferenceManifest(readFileSync(file, 'utf8'), file),
  );
  const results = checkFirstLoad({
    layouts: GUARDED_LAYOUTS,
    rootFiles,
    manifests,
    readChunk: chunkReader(BUILD_DIR),
  });

  for (const { layout, chunks, gzipBytes } of results) {
    process.stdout.write(
      `First load of ${layout}: ${chunks.length} chunks, ${(gzipBytes / 1024).toFixed(1)} KB gzip\n`,
    );
  }
  const failures = results.filter((result) => result.zodChunks.length > 0);
  for (const { layout, zodChunks } of failures) {
    process.stderr.write(
      `Zod is in the first load of ${layout} (${zodChunks.join(', ')}). Keep it out as ` +
        '§18.5 of docs/spec/18-code-patterns.md describes: a module the first paint does not ' +
        'need loads after it.\n',
    );
  }
  if (failures.length > 0) process.exit(1);
}

if (process.argv[1] === import.meta.filename) {
  main();
}
