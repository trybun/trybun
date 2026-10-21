// Lint configuration of apps/server: layers and module boundaries of §18.3.
import { defineConfig } from 'eslint/config';
import { base, packageBoundaries, restrictedImports } from './base.js';

/** Every parameter decorator of a handler declares its contract schema (§18.3). */
const PARAMETER_WITHOUT_SCHEMA = {
  selector:
    "Decorator > CallExpression[callee.name=/^(Body|Query|Param|MessageBody)$/]:not(:has(Property[key.name='schema']))",
  message: 'Declare the contract schema of the parameter with the `schema` option (§18.3).',
};

/** Domain functions receive the current time as a parameter (§18.3). */
const READING_THE_CLOCK = [
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: 'Domain functions receive `now` as a parameter (§18.3).',
  },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: 'Domain functions receive `now` as a parameter (§18.3).',
  },
];

const PRISMA = {
  regex: '(^@prisma/|^prisma$|/generated/prisma|/platform/database/)',
  message: 'Only services and platform modules access the database (§18.3).',
};

/**
 * @param {{ allowedPackages: string[], root: string }} options `root` is the application folder
 */
export function nestjs({ allowedPackages, root }) {
  return defineConfig(
    ...base,
    packageBoundaries(allowedPackages),
    {
      name: 'trybun/nestjs',
      rules: {
        'no-restricted-syntax': ['error', PARAMETER_WITHOUT_SCHEMA],
        'import-x/no-restricted-paths': [
          'error',
          {
            basePath: root,
            zones: [
              {
                target: './src/platform',
                from: './src/modules',
                message: '`platform` never imports feature modules (§18.3).',
              },
            ],
          },
        ],
      },
    },
    {
      name: 'trybun/nestjs-transport',
      files: ['src/**/*.{controller,gateway,processor}.ts'],
      rules: { 'no-restricted-imports': restrictedImports(PRISMA) },
    },
    {
      name: 'trybun/nestjs-domain',
      files: ['src/modules/*/domain/**/*.ts'],
      rules: {
        'no-restricted-imports': restrictedImports(PRISMA, {
          regex:
            '(^@nestjs/|/platform/(?!errors/)|\\.(module|controller|service|gateway|processor|abilities|sql)(\\.js)?$)',
          message: 'Domain rules are pure functions without NestJS, Prisma or I/O (§18.3).',
        }),
        'no-restricted-syntax': ['error', PARAMETER_WITHOUT_SCHEMA, ...READING_THE_CLOCK],
      },
    },
    {
      name: 'trybun/nestjs-config',
      files: ['src/platform/config/**/*.ts'],
      rules: { 'no-restricted-properties': 'off' },
    },
    {
      name: 'trybun/nestjs-tests',
      files: ['**/*.spec.ts'],
      rules: { '@typescript-eslint/no-extraneous-class': 'off' },
    },
  );
}
