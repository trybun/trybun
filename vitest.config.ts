import { readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Coverage gate of CI (§2.14): unit and integration tests of all packages run together, and the
// thresholds are checked once on the combined result. `pnpm test` and `pnpm test:integration`
// run per package without thresholds.

const WORKSPACES = ['apps', 'packages'].flatMap((folder) =>
  readdirSync(folder, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `${folder}/${entry.name}`),
);

// Domain modules of the server and the shared contracts.
const DOMAIN_THRESHOLDS = { lines: 80, branches: 75 };
// Every other package and application.
const PACKAGE_THRESHOLDS = { lines: 70 };

export default defineConfig({
  test: {
    projects: [
      '{apps,packages}/*/vitest.config.{ts,js}',
      '{apps,packages}/*/vitest.integration.config.{ts,js}',
      // Repository tooling run by CI.
      { test: { name: 'scripts', include: ['scripts/**/*.spec.js'] } },
    ],
    coverage: {
      provider: 'v8',
      include: ['{apps,packages}/*/src/**'],
      // The closed list of excluded files (§2.14); adding a pattern is a specification change.
      exclude: [
        // Test code
        '**/*.spec.{ts,tsx,js}',
        '**/test/**',
        '**/e2e/**',
        // Storybook stories
        '**/*.stories.tsx',
        // Process entry points that only bootstrap
        'apps/server/src/main.ts',
        'apps/server/src/worker.ts',
        // Generated code: the Prisma Client (`prisma generate`)
        'apps/server/src/generated/**',
        // Configuration files and type declarations
        '**/*.config.{ts,js,mjs}',
        '**/*.d.ts',
        // Further generated code joins with the tasks that generate it; the seed script and the
        // demo dataset are outside `src/` (`apps/server/prisma/`).
      ],
      reporter: ['text-summary', 'json-summary', 'html'],
      thresholds: {
        ...Object.fromEntries(WORKSPACES.map((path) => [`${path}/src/**`, PACKAGE_THRESHOLDS])),
        'apps/server/src/modules/**': DOMAIN_THRESHOLDS,
        'packages/contracts/src/**': DOMAIN_THRESHOLDS,
      },
    },
  },
});
