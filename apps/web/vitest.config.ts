import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web',
    // The unit tests of the E2E helpers (`*.unit.spec.ts`), which Playwright ignores.
    include: ['src/**/*.spec.{ts,tsx}', 'scripts/**/*.spec.ts', 'e2e/**/*.unit.spec.ts'],
    exclude: ['**/*.integration.spec.{ts,tsx}'],
    setupFiles: ['test/setup/query-notifications.ts'],
  },
});
