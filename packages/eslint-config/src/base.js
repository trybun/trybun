// Shared lint rules of every package and application (§17.1, §18.9).
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import checkFile from 'eslint-plugin-check-file';
import { importX } from 'eslint-plugin-import-x';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

/** Imports forbidden everywhere: Radix UI and vaul are not used (§14.5, §18.9). */
export const FORBIDDEN_IMPORT_PATTERNS = [
  {
    group: ['radix-ui', '@radix-ui/*', 'vaul'],
    message: 'Use the Base UI primitives of @trybun/ui (§14.5).',
  },
];

/** Configuration files and files whose default export a framework requires. */
export const FRAMEWORK_FILES = ['**/*.config.{ts,js,mjs}'];

/**
 * `no-restricted-imports` with the patterns forbidden everywhere and the given extra patterns.
 * Flat config replaces a rule's options, so every override lists all patterns it needs.
 * @param {Array<object>} patterns
 */
export function restrictedImports(...patterns) {
  return ['error', { patterns: [...FORBIDDEN_IMPORT_PATTERNS, ...patterns] }];
}

/** Shared tooling every package may use. */
const TOOLING_PACKAGES = ['@trybun/eslint-config', '@trybun/tsconfig'];

/**
 * Package boundaries (§14.6): the only `@trybun/*` packages a package may import.
 * @param {string[]} allowedPackages
 */
export function packageBoundaries(allowedPackages) {
  const allowed = [...TOOLING_PACKAGES, ...allowedPackages].map((name) =>
    name.replace('@trybun/', ''),
  );
  return {
    name: 'trybun/package-boundaries',
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: `^@trybun/(?!(${allowed.join('|')})(/|$))`,
              message: `This package may import only ${allowedPackages.join(', ') || 'no other @trybun/* package'} (§14.6).`,
            },
          ],
        },
      ],
    },
  };
}

export const base = defineConfig(
  {
    name: 'trybun/ignores',
    ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/next-env.d.ts'],
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    name: 'trybun/base',
    languageOptions: {
      parserOptions: { projectService: true },
    },
    plugins: { 'import-x': importX, 'check-file': checkFile },
    settings: {
      // Without a parser for TypeScript, import-x cannot read dependencies, e.g. for no-cycle.
      'import-x/extensions': ['.ts', '.tsx', '.js', '.mjs'],
      'import-x/parsers': { '@typescript-eslint/parser': ['.ts', '.tsx'] },
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: {
      'no-console': 'error',
      'no-restricted-imports': restrictedImports(),
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read the environment only in the configuration module (§18.3).',
        },
      ],
      'import-x/no-cycle': 'error',
      'import-x/no-relative-packages': 'error',
      'import-x/no-default-export': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        { selector: 'default', format: ['camelCase'], leadingUnderscore: 'allow' },
        { selector: 'import', format: ['camelCase', 'PascalCase'] },
        { selector: 'variable', format: ['camelCase', 'PascalCase', 'UPPER_CASE'] },
        {
          // UPPER_SNAKE_CASE module constants (§17.1) keep the plain variable rule.
          selector: 'variable',
          types: ['boolean'],
          filter: { regex: '^[A-Z][A-Z0-9_]*$', match: false },
          format: ['PascalCase'],
          prefix: ['is', 'has', 'can', 'should'],
        },
        { selector: 'function', format: ['camelCase', 'PascalCase'] },
        { selector: 'typeLike', format: ['PascalCase'] },
        {
          selector: 'interface',
          format: ['PascalCase'],
          custom: { regex: '^I[A-Z]', match: false },
        },
        {
          selector: 'classProperty',
          modifiers: ['static', 'readonly'],
          format: ['UPPER_CASE', 'camelCase'],
        },
        { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
      ],
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.{ts,tsx,js,mjs}': 'KEBAB_CASE' },
        { ignoreMiddleExtensions: true },
      ],
      'check-file/folder-naming-convention': ['error', { '{src,test}/**/': 'KEBAB_CASE' }],
    },
  },
  {
    name: 'trybun/framework-files',
    files: FRAMEWORK_FILES,
    rules: { 'import-x/no-default-export': 'off' },
  },
  {
    name: 'trybun/javascript',
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
