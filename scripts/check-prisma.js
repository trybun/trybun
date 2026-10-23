// Prisma checks of `pnpm lint` (§14.2, §17.1): every model and multi-word field of the Prisma
// schema has its snake_case database mapping, and the lockfile contains no Prisma ORM 8 package.
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCHEMA_FILE = 'apps/server/prisma/schema.prisma';
const LOCKFILE = 'pnpm-lock.yaml';

/** Prisma ORM 7 is the supported major; Prisma ORM 8 waits for its planned task (§14.2). */
const PRISMA_MAJOR = 7;
/** Packages with their own version line: the engine build identifier starts with 8 in Prisma 7. */
const OWN_VERSION_PACKAGES = new Set(['@prisma/engines-version']);

const BLOCK = /^(model|enum)\s+(\w+)\s*\{([^}]*)\}/gm;
const MAP = /@map\("([^"]*)"\)/;
const BLOCK_MAP = /@@map\("([^"]*)"\)/;
const SNAKE_CASE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;
const LOCKED_PACKAGE = /^ {2}'?(prisma|@prisma\/[\w.-]+)@(\d+)\.[^\s:']*'?:/gm;

/** `ActivityEvent` → `activity_event`, `requesterId` → `requester_id`. */
export function toSnakeCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/** 1-based line number of the character at `index`. */
function lineOf(content, index) {
  return content.slice(0, index).split('\n').length;
}

/** The lines of a block body with their line numbers, without comments and empty lines. */
function bodyLines(content, block) {
  const firstLine = lineOf(content, block.index);
  return block[3]
    .split('\n')
    .map((text, offset) => ({ text: text.replace(/\/\/.*$/, '').trim(), line: firstLine + offset }))
    .filter(({ text }) => text !== '');
}

/**
 * Missing or wrong database mappings of a Prisma schema.
 * @param {string} path path of the schema, relative to the repository root
 * @param {string} content
 * @returns {string[]} one message per problem
 */
export function findSchemaProblems(path, content) {
  const blocks = [...content.matchAll(BLOCK)];
  const models = new Set(blocks.filter(([, kind]) => kind === 'model').map(([, , name]) => name));
  const enums = new Set(blocks.filter(([, kind]) => kind === 'enum').map(([, , name]) => name));
  const problems = [];
  for (const block of blocks) {
    const [, kind, name, body] = block;
    const at = `${path}:${lineOf(content, block.index)}`;
    const mapped = BLOCK_MAP.exec(body)?.[1];
    const lines = bodyLines(content, block);
    if (kind === 'model') {
      if (mapped === undefined) {
        problems.push(`${at}: model ${name} has no @@map("<plural_snake_case>")`);
      } else if (!SNAKE_CASE.test(mapped) || mapped === toSnakeCase(name)) {
        problems.push(`${at}: model ${name} maps to "${mapped}", not a plural snake_case table`);
      }
      for (const { text, line } of lines) {
        const [field, type] = text.split(/\s+/);
        const baseType = type?.replace(/[?[\]]/g, '');
        if (field.startsWith('@@') || models.has(baseType)) {
          continue;
        }
        const column = MAP.exec(text)?.[1] ?? field;
        if (column !== toSnakeCase(field)) {
          problems.push(
            `${path}:${line}: field ${name}.${field} needs @map("${toSnakeCase(field)}")`,
          );
        }
      }
    } else {
      if (toSnakeCase(name).includes('_') && mapped !== toSnakeCase(name)) {
        problems.push(`${at}: enum ${name} needs @@map("${toSnakeCase(name)}")`);
      }
      for (const { text, line } of lines) {
        if (!text.startsWith('@@') && !SNAKE_CASE.test(text.split(/\s+/)[0])) {
          problems.push(`${path}:${line}: value ${name}.${text} is not snake_case`);
        }
      }
    }
  }
  if (models.size === 0 && enums.size === 0) {
    problems.push(`${path}: no model found`);
  }
  return problems;
}

/**
 * Locked Prisma packages of another major than Prisma ORM 7.
 * @param {string} path path of the lockfile, relative to the repository root
 * @param {string} content
 * @returns {string[]} one message per package version
 */
export function findPrismaMajorProblems(path, content) {
  const problems = new Set();
  for (const [, name, major] of content.matchAll(LOCKED_PACKAGE)) {
    if (!OWN_VERSION_PACKAGES.has(name) && Number(major) > PRISMA_MAJOR) {
      problems.add(
        `${path}: ${name}@${major} is a Prisma ORM ${major} package; use ${PRISMA_MAJOR}.x (§14.2)`,
      );
    }
  }
  return [...problems];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = relative(process.cwd(), join(dirname(fileURLToPath(import.meta.url)), '..')) || '.';
  const read = (path) => readFileSync(join(root, path), 'utf8');
  const problems = [
    ...findSchemaProblems(SCHEMA_FILE, read(SCHEMA_FILE)),
    ...findPrismaMajorProblems(LOCKFILE, read(LOCKFILE)),
  ];
  for (const problem of problems) {
    process.stderr.write(`${problem}\n`);
  }
  process.stdout.write(
    problems.length === 0
      ? 'Prisma checks: all passed.\n'
      : `Prisma checks: ${problems.length} problems.\n`,
  );
  process.exitCode = problems.length === 0 ? 0 : 1;
}
