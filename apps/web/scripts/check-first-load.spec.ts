import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  checkFirstLoad,
  chunkReader,
  clientReferenceManifestFiles,
  GUARDED_LAYOUTS,
  parseBuildManifest,
  parseClientReferenceManifest,
  type EntryFiles,
} from './check-first-load.ts';

const ROOT_LAYOUT = '[project]/apps/web/src/app/layout';
const TEAM_LAYOUT = '[project]/apps/web/src/app/(team)/layout';
const PORTAL_LAYOUT = '[project]/apps/web/src/app/(portal)/layout';
const HELP_LAYOUT = '[project]/apps/web/src/app/help/layout';
const FORM_PAGE = '[project]/apps/web/src/app/(team)/tickets/new/page';

// As the minified Zod 4 chunks of `next build` define the base schema classes.
const ZOD_CHUNK = 'var a=(0,r.$constructor)("ZodType",(e,t)=>{});';
const ZOD_MINI_CHUNK = "var b=(0,r.$constructor)('ZodMiniType',(e,t)=>{});";
const ZOD_CORE_CHUNK = 'var c=(0,r.$constructor)("$ZodType",(e,t)=>{}),d={jitless:!0};';

const files = {
  'static/chunks/main.js': 'main();',
  'static/chunks/root.js': 'root();',
  'static/chunks/shell.js': 'shell();',
  'static/chunks/form.js': ZOD_CHUNK,
};

function chunks(contents: Record<string, string>) {
  return (file: string) => {
    const content = contents[file];
    if (content === undefined) throw new Error(`Unexpected chunk ${file}`);
    return Buffer.from(content);
  };
}

/** The manifest of the empty shell, with the page of a form that loads Zod after it. */
const shellManifest: EntryFiles = {
  [ROOT_LAYOUT]: ['static/chunks/root.js'],
  [TEAM_LAYOUT]: ['static/chunks/root.js', 'static/chunks/shell.js'],
  [FORM_PAGE]: ['static/chunks/root.js', 'static/chunks/shell.js', 'static/chunks/form.js'],
};

function checkTeamLayout(contents: Record<string, string>, manifests = [shellManifest]) {
  const [result] = checkFirstLoad({
    layouts: ['app/(team)/layout'],
    rootFiles: ['static/chunks/main.js'],
    manifests,
    readChunk: chunks(contents),
  });
  return result;
}

function manifestSource(manifests: Record<string, EntryFiles>) {
  return [
    'globalThis.__RSC_MANIFEST = globalThis.__RSC_MANIFEST || {};',
    ...Object.entries(manifests).map(
      ([page, entryJSFiles]) =>
        `globalThis.__RSC_MANIFEST[${JSON.stringify(page)}] = ${JSON.stringify({
          moduleLoading: { prefix: '' },
          clientModules: {},
          entryCSSFiles: {},
          entryJSFiles,
        })};`,
    ),
  ].join('\n');
}

describe('parseClientReferenceManifest', () => {
  it('returns the entryJSFiles of every manifest the file assigns', () => {
    const source = manifestSource({
      '/(team)/page': shellManifest,
      '/(team)/tickets/page': { [TEAM_LAYOUT]: ['static/chunks/shell.js'] },
    });

    expect(parseClientReferenceManifest(source, 'page_client-reference-manifest.js')).toEqual([
      shellManifest,
      { [TEAM_LAYOUT]: ['static/chunks/shell.js'] },
    ]);
  });

  it('fails for a file of another format, so a changed build never passes silently', () => {
    expect(() =>
      parseClientReferenceManifest(
        'globalThis.__RSC_MANIFEST = { "/(team)/page": { entryFiles: {} } };',
        'page_client-reference-manifest.js',
      ),
    ).toThrow(/page_client-reference-manifest\.js is not a client reference manifest/);
    expect(() =>
      parseClientReferenceManifest('var unrelated = 1;', 'page_client-reference-manifest.js'),
    ).toThrow(/is not a client reference manifest/);
  });

  it('does not reach the globals of the process running the check', () => {
    const source =
      'globalThis.__RSC_MANIFEST = { "/page": { entryJSFiles: {} } }; process.exit(1);';

    expect(() => parseClientReferenceManifest(source, 'page_client-reference-manifest.js')).toThrow(
      /process is not defined/,
    );
  });
});

describe('parseBuildManifest', () => {
  it('returns the root main files, which every page loads, without the noModule polyfills', () => {
    const source = JSON.stringify({
      polyfillFiles: ['static/chunks/polyfills.js'],
      rootMainFiles: ['static/chunks/main.js', 'static/chunks/turbopack.js'],
      pages: {},
    });

    expect(parseBuildManifest(source)).toEqual([
      'static/chunks/main.js',
      'static/chunks/turbopack.js',
    ]);
  });

  it('fails for a manifest without them', () => {
    expect(() => parseBuildManifest(JSON.stringify({ pages: {} }))).toThrow();
  });
});

describe('checkFirstLoad', () => {
  it('passes a first load without Zod and reports its chunks and gzip size', () => {
    const firstLoad = ['static/chunks/main.js', 'static/chunks/root.js', 'static/chunks/shell.js'];

    expect(checkTeamLayout(files)).toEqual({
      layout: 'app/(team)/layout',
      chunks: firstLoad,
      gzipBytes: firstLoad.reduce((sum, chunk) => sum + gzipSync(chunks(files)(chunk)).length, 0),
      zodChunks: [],
    });
  });

  it('finds Zod in an entry chunk of the layout (#372)', () => {
    expect(checkTeamLayout({ ...files, 'static/chunks/shell.js': ZOD_CHUNK })?.zodChunks).toEqual([
      'static/chunks/shell.js',
    ]);
  });

  it('finds Zod Mini', () => {
    expect(
      checkTeamLayout({ ...files, 'static/chunks/shell.js': ZOD_MINI_CHUNK })?.zodChunks,
    ).toEqual(['static/chunks/shell.js']);
  });

  it('finds Zod in a file every page loads, outside the entry chunks of the layout', () => {
    expect(checkTeamLayout({ ...files, 'static/chunks/main.js': ZOD_CHUNK })?.zodChunks).toEqual([
      'static/chunks/main.js',
    ]);
  });

  it('allows the core of Zod that the configuration of instrumentation-client.ts brings', () => {
    expect(
      checkTeamLayout({ ...files, 'static/chunks/main.js': ZOD_CORE_CHUNK })?.zodChunks,
    ).toEqual([]);
  });

  it('merges the entry chunks of a layout from every manifest', () => {
    const result = checkTeamLayout({ ...files, 'static/chunks/zod.js': ZOD_CHUNK }, [
      shellManifest,
      { [TEAM_LAYOUT]: ['static/chunks/shell.js', 'static/chunks/zod.js'] },
    ]);

    expect(result?.chunks).toEqual([
      'static/chunks/main.js',
      'static/chunks/root.js',
      'static/chunks/shell.js',
      'static/chunks/zod.js',
    ]);
    expect(result?.zodChunks).toEqual(['static/chunks/zod.js']);
  });

  it('does not take the chunks of a nested layout or a page as those of the shell', () => {
    const result = checkTeamLayout(files, [
      {
        ...shellManifest,
        '[project]/apps/web/src/app/(team)/tickets/layout': ['static/chunks/form.js'],
      },
    ]);

    expect(result?.zodChunks).toEqual([]);
  });

  it('checks every layout of the shell', () => {
    const results = checkFirstLoad({
      layouts: GUARDED_LAYOUTS,
      rootFiles: [],
      manifests: [
        shellManifest,
        { [PORTAL_LAYOUT]: ['static/chunks/root.js'], [HELP_LAYOUT]: ['static/chunks/form.js'] },
      ],
      readChunk: chunks(files),
    });

    expect(results.map(({ layout, zodChunks }) => ({ layout, zodChunks }))).toEqual([
      { layout: 'app/(team)/layout', zodChunks: [] },
      { layout: 'app/(portal)/layout', zodChunks: [] },
      { layout: 'app/help/layout', zodChunks: ['static/chunks/form.js'] },
    ]);
  });

  it('fails for a layout that no manifest lists', () => {
    expect(() =>
      checkFirstLoad({
        layouts: ['app/(portal)/layout'],
        rootFiles: [],
        manifests: [shellManifest],
        readChunk: chunks(files),
      }),
    ).toThrow(
      'The layout app/(portal)/layout is not in any client reference manifest of the build.',
    );
  });

  it('fails when no chunk of the build matches the marker, so a renamed class never passes', () => {
    expect(() =>
      checkTeamLayout({ ...files, 'static/chunks/form.js': 'var a=r.$constructor("Schema");' }),
    ).toThrow(/No entry chunk of the build matches .* the marker no longer identifies Zod/);
  });
});

describe('chunkReader', () => {
  it('reads a chunk by its path in the build directory', () => {
    const buildDir = mkdtempSync(join(tmpdir(), 'check-first-load-'));
    try {
      mkdirSync(join(buildDir, 'static/chunks'), { recursive: true });
      writeFileSync(join(buildDir, 'static/chunks/shell.js'), 'shell();');

      expect(chunkReader(buildDir)('static/chunks/shell.js').toString()).toBe('shell();');
    } finally {
      rmSync(buildDir, { recursive: true, force: true });
    }
  });

  it('fails for a chunk that the build lists but does not contain', () => {
    const buildDir = mkdtempSync(join(tmpdir(), 'check-first-load-'));
    try {
      expect(() => chunkReader(buildDir)('static/chunks/missing.js')).toThrow(
        'The chunk static/chunks/missing.js listed by the build is missing.',
      );
    } finally {
      rmSync(buildDir, { recursive: true, force: true });
    }
  });
});

describe('clientReferenceManifestFiles', () => {
  it('finds the client reference manifest of every page, in route groups at any depth', () => {
    const appDir = mkdtempSync(join(tmpdir(), 'check-first-load-'));
    try {
      for (const dir of ['(team)/tickets/new', 'help'])
        mkdirSync(join(appDir, dir), { recursive: true });
      writeFileSync(join(appDir, '(team)/page_client-reference-manifest.js'), '');
      writeFileSync(join(appDir, '(team)/tickets/new/page_client-reference-manifest.js'), '');
      writeFileSync(join(appDir, '(team)/tickets/new/page.js'), '');
      writeFileSync(join(appDir, 'help/route_client-reference-manifest.js'), '');

      expect(clientReferenceManifestFiles(appDir).sort()).toEqual([
        join(appDir, '(team)/page_client-reference-manifest.js'),
        join(appDir, '(team)/tickets/new/page_client-reference-manifest.js'),
      ]);
    } finally {
      rmSync(appDir, { recursive: true, force: true });
    }
  });
});
