import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests (§18.7): PostgreSQL and Valkey in Testcontainers, external HTTP services in MSW.
export default defineConfig({
  // SWC emits the decorator metadata NestJS dependency injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'server-integration',
    include: ['src/**/*.integration.spec.ts', 'test/**/*.integration.spec.ts'],
    globalSetup: ['test/setup/containers.ts'],
    setupFiles: ['test/setup/msw.ts'],
    // Pulling the images and starting the containers on a cold CI runner.
    hookTimeout: 120_000,
  },
});
