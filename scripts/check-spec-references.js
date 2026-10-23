// Specification consistency check (§2.8, §2.14): every `§N.M` reference points to an existing
// section of docs/spec/, and a link labelled with `§N.M` points to the file of that section.
// Links and headings themselves are checked by lychee (lychee.toml).
import { globSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_FOLDER = 'docs/spec';
const CHECKED_FILES = '**/*.{md,ts,tsx,js,mjs,yml,yaml}';
const IGNORED_FILES = [
  '**/node_modules/**',
  '**/dist/**',
  '**/.next/**',
  '**/coverage/**',
  '.git/**',
  // State of Cezar, history of abandoned specifications and the generated changelog.
  '.ai/cezar/**',
  '.ai/specs/archive/**',
  '.claude/skills/**',
  'CHANGELOG.md',
];

const SECTION_HEADING = /^#{1,6} (\d+(?:\.\d+)*) /gm;
const REFERENCE = /§(\d+(?:\.\d+)*)/g;
const SECTION_LINK = /\[([^\]]*§[^\]]*)\]\(([^)\s#]*)(?:#[^)\s]*)?\)/g;

/**
 * Section numbers defined by the headings of each specification file.
 * @param {Map<string, string>} specFiles path of a specification file → its content
 * @returns {Map<string, string>} section number → path of the file defining it
 */
export function collectSections(specFiles) {
  const sections = new Map();
  for (const [path, content] of specFiles) {
    for (const [, section] of content.matchAll(SECTION_HEADING)) {
      sections.set(section, path);
    }
  }
  return sections;
}

/** 1-based line number of the character at `index`. */
function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

/**
 * Broken references of one file.
 * @param {string} path path of the file, relative to the repository root
 * @param {string} content
 * @param {Map<string, string>} sections result of `collectSections`
 * @returns {string[]} one message per broken reference
 */
export function findBrokenReferences(path, content, sections) {
  const problems = [];
  for (const match of content.matchAll(REFERENCE)) {
    if (!sections.has(match[1])) {
      problems.push(`${path}:${lineOf(content, match.index)}: §${match[1]} does not exist`);
    }
  }
  for (const match of content.matchAll(SECTION_LINK)) {
    const [, label, target] = match;
    const targetPath = target === '' ? path : normalize(join(dirname(path), target));
    if (!targetPath.startsWith(`${SPEC_FOLDER}/`)) {
      continue;
    }
    for (const [, section] of label.matchAll(REFERENCE)) {
      const definedIn = sections.get(section);
      if (definedIn !== undefined && definedIn !== targetPath) {
        problems.push(
          `${path}:${lineOf(content, match.index)}: §${section} links to ${targetPath}, but is defined in ${definedIn}`,
        );
      }
    }
  }
  return problems;
}

/**
 * Broken references of the repository at `root`.
 * @param {string} root
 * @returns {string[]}
 */
export function checkRepository(root) {
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const specFiles = new Map(
    globSync(`${SPEC_FOLDER}/*.md`, { cwd: root }).map((path) => [path, read(path)]),
  );
  const sections = collectSections(specFiles);
  return globSync(CHECKED_FILES, { cwd: root, exclude: IGNORED_FILES })
    .sort()
    .flatMap((path) => findBrokenReferences(path, read(path), sections));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = relative(process.cwd(), join(dirname(fileURLToPath(import.meta.url)), '..')) || '.';
  const problems = checkRepository(root);
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.stdout.write(
    problems.length === 0
      ? 'Specification references: all valid.\n'
      : `Specification references: ${problems.length} broken.\n`,
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
