import { defineConfig } from 'vitest/config';

// Integration tests (§18.7): PostgreSQL in Testcontainers, Keycloak in MSW.
export default defineConfig({
  test: {
    name: 'web-integration',
    include: ['src/**/*.integration.spec.{ts,tsx}'],
    globalSetup: ['test/setup/containers.ts'],
    setupFiles: ['test/setup/msw.ts'],
    // Building the PostgreSQL image and starting the container on a cold CI runner.
    hookTimeout: 120_000,
  },
});
