// Generates the Keycloak login theme `trybun` from the `keycloak` namespace of the message
// catalogues (§13.1, §14.2): `theme.properties` and one `messages_<locale>.properties` per
// catalogue. `--check` only compares the files with the catalogues and fails when they differ
// (`pnpm lint`).
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import process from 'node:process';
import { isArgumentElement, isLiteralElement, parse } from '@formatjs/icu-messageformat-parser';

const ROOT = join(import.meta.dirname, '../../..');
const MESSAGES_DIR = join(import.meta.dirname, '../messages');
export const THEME_DIR = join(ROOT, 'docker/keycloak/themes/trybun/login');

const HEADER = [
  '# Generated from packages/i18n/messages by packages/i18n/scripts/generate-keycloak-theme.js.',
  '# Do not edit: change the catalogues and run `pnpm build`.',
];
const KEY = /^[A-Za-z][A-Za-z0-9.]*$/;

/**
 * An ICU message as a Java `MessageFormat` pattern, which Keycloak applies to its messages.
 * Keycloak passes positional arguments, so only literal text and `{0}`, `{1}`… are allowed.
 * @param {string} message
 */
export function toJavaMessageFormat(message) {
  return parse(message)
    .map((element) => {
      if (isLiteralElement(element)) {
        return element.value.replaceAll("'", "''").replaceAll(/[{}]/g, "'$&'");
      }
      if (isArgumentElement(element) && /^\d+$/.test(element.value)) {
        return `{${element.value}}`;
      }
      throw new Error(`Only text and positional arguments ({0}) are allowed: ${message}`);
    })
    .join('');
}

/** A value of a `.properties` file: ASCII only, with Unicode escapes for everything else. */
function escapeValue(value) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replace(/^\s/, (space) => `\\${space}`)
    .replaceAll(
      /[^\x20-\x7e]/g,
      (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
    );
}

/**
 * The files of the theme for the catalogues, by path relative to the theme folder.
 * @param {Record<string, { keycloak?: Record<string, unknown> }>} catalogues by locale
 * @returns {Map<string, string>}
 */
export function renderTheme(catalogues) {
  const locales = Object.keys(catalogues).sort();
  const files = new Map([
    [
      'theme.properties',
      [...HEADER, 'parent=keycloak.v2', `locales=${locales.join(',')}`, ''].join('\n'),
    ],
  ]);
  for (const locale of locales) {
    const lines = Object.entries(catalogues[locale].keycloak ?? {}).map(([key, message]) => {
      if (!KEY.test(key) || typeof message !== 'string') {
        throw new Error(`keycloak.${key} (${locale}) must be a message with a Keycloak key`);
      }
      return `${key}=${escapeValue(toJavaMessageFormat(message))}`;
    });
    files.set(
      `messages/messages_${locale}.properties`,
      [...HEADER, ...lines.sort(), ''].join('\n'),
    );
  }
  return files;
}

/** The catalogues of `packages/i18n/messages` by locale. */
export function readCatalogues(dir = MESSAGES_DIR) {
  return Object.fromEntries(
    readdirSync(dir)
      .filter((file) => file.endsWith('.json'))
      .map((file) => [
        file.replace(/\.json$/, ''),
        JSON.parse(readFileSync(join(dir, file), 'utf8')),
      ]),
  );
}

/**
 * The theme files that differ from the catalogues, including stale message files.
 * @param {Map<string, string>} files
 * @param {string} themeDir
 */
export function findStaleFiles(files, themeDir) {
  const read = (path) => {
    try {
      return readFileSync(join(themeDir, path), 'utf8');
    } catch {
      return undefined;
    }
  };
  const existing = (() => {
    try {
      return readdirSync(join(themeDir, 'messages')).map((file) => `messages/${file}`);
    } catch {
      return [];
    }
  })();
  return [...new Set([...files.keys(), ...existing])]
    .filter((path) => read(path) !== files.get(path))
    .sort();
}

function main() {
  const files = renderTheme(readCatalogues());
  if (process.argv.includes('--check')) {
    const stale = findStaleFiles(files, THEME_DIR);
    if (stale.length > 0) {
      const paths = stale.map((path) => `  ${relative(ROOT, join(THEME_DIR, path))}`);
      process.stderr.write(
        ['The Keycloak theme is out of date; run `pnpm build`:', ...paths, ''].join('\n'),
      );
      process.exit(1);
    }
    return;
  }
  for (const path of findStaleFiles(files, THEME_DIR)) {
    const content = files.get(path);
    if (content === undefined) {
      rmSync(join(THEME_DIR, path));
    } else {
      mkdirSync(join(THEME_DIR, path, '..'), { recursive: true });
      writeFileSync(join(THEME_DIR, path), content);
    }
  }
}

if (process.argv[1] === import.meta.filename) {
  main();
}
