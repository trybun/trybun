import { defineConfig, devices } from '@playwright/test';
import { TEAM_STORAGE_STATE } from './e2e/storage-state.js';

const isCi = process.env.CI !== undefined;
/** The unit tests of the E2E helpers, which Vitest runs (`vitest.config.ts`). */
const UNIT_TESTS = /\.unit\.spec\.ts$/;

/**
 * E2E tests (§2.14): the key user paths on phone, tablet and desktop (§2.9) against the local
 * environment (§15.12) – the seeded accounts of the demo dataset and the development realm of
 * Keycloak. Locally they reuse the web application and the API of `pnpm dev`.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCi,
  reporter: isCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /\.setup\.ts$/ },
    {
      // The narrowest supported width (§2.9).
      name: 'phone',
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 360, height: 780 },
        storageState: TEAM_STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: [/lighthouse\.spec\.ts$/, UNIT_TESTS],
    },
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 11)'], storageState: TEAM_STORAGE_STATE },
      dependencies: ['setup'],
      // The React Compiler check concerns the build, not the device: it runs in the Chromium
      // projects, whose React DevTools hook it stubs (WebKit reports no React roots to it).
      testIgnore: [/lighthouse\.spec\.ts$/, /react-compiler\.spec\.ts$/, UNIT_TESTS],
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: TEAM_STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: [/lighthouse\.spec\.ts$/, UNIT_TESTS],
    },
    {
      // The performance budget of the key pages, measured with the mobile profile of Lighthouse.
      // It runs after the other projects and one page at a time: the CPU slowdown is applied to
      // the runner's real CPU (#503, #508), so a parallel test on the same runner moves the
      // measurement (#146).
      name: 'lighthouse',
      testMatch: /lighthouse\.spec\.ts$/,
      dependencies: ['setup', 'phone', 'tablet', 'desktop'],
      workers: 1,
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @trybun/server start',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !isCi,
      // The parallel tests share the seeded accounts and the client IP, so the API they start
      // allows more than the default rate limits; the integration tests check the defaults.
      env: { TRYBUN_RATE_LIMIT_PER_USER: '10000', TRYBUN_RATE_LIMIT_PER_IP: '10000' },
    },
    {
      // The Worker checks, strips and releases the uploaded attachments (§13.3). It serves no HTTP,
      // so nothing is awaited; next to a running `pnpm dev` it is a second consumer of the queues.
      command: 'pnpm --filter @trybun/server start:worker',
    },
    {
      command: 'pnpm exec next start --port 3000',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !isCi,
      // The pseudo-locale of the width-sensitive checks (§2.9, `e2e/locales.ts`); `next dev`, which
      // a local run reuses, serves it without the variable.
      env: { TRYBUN_PSEUDO_LOCALE: 'true' },
    },
  ],
});
