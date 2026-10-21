// Lint configuration of apps/web: layers of §18.5.
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig } from 'eslint/config';
import { base, packageBoundaries } from './base.js';
import { react } from './react.js';

/**
 * @param {{ allowedPackages: string[], root: string }} options `root` is the application folder
 */
export function nextjs({ allowedPackages, root }) {
  return defineConfig(
    ...base,
    packageBoundaries(allowedPackages),
    ...react,
    {
      name: 'trybun/next',
      plugins: { '@next/next': nextPlugin },
      rules: {
        ...nextPlugin.configs.recommended.rules,
        ...nextPlugin.configs['core-web-vitals'].rules,
        'import-x/no-restricted-paths': [
          'error',
          {
            basePath: root,
            zones: [
              {
                target: './src/lib',
                from: ['./src/features', './src/app'],
                message: 'Dependencies point one way: app → features → lib (§18.5).',
              },
              {
                target: './src/features',
                from: './src/app',
                message: 'Dependencies point one way: app → features → lib (§18.5).',
              },
            ],
          },
        ],
      },
    },
    {
      name: 'trybun/next-app-router',
      files: ['src/app/**'],
      rules: {
        'import-x/no-default-export': 'off',
        'check-file/folder-naming-convention': [
          'error',
          { 'src/app/**/': 'NEXT_JS_APP_ROUTER_CASE' },
        ],
      },
    },
    {
      name: 'trybun/next-environment',
      files: ['src/lib/env/**', 'src/instrumentation.ts'],
      rules: { 'no-restricted-properties': 'off' },
    },
  );
}
