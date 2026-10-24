import { defineConfig, devices } from '@playwright/test';
import { TEAM_STORAGE_STATE } from './e2e/storage-state.js';

const isCi = process.env.CI !== undefined;

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
      testIgnore: /lighthouse\.spec\.ts$/,
    },
    {
      name: 'tablet',
      use: { ...devices['iPad (gen 11)'], storageState: TEAM_STORAGE_STATE },
      dependencies: ['setup'],
      // The React Compiler check concerns the build, not the device: it runs in the Chromium
      // projects, whose React DevTools hook it stubs (WebKit reports no React roots to it).
      testIgnore: [/lighthouse\.spec\.ts$/, /react-compiler\.spec\.ts$/],
    },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: TEAM_STORAGE_STATE,
      },
      dependencies: ['setup'],
      testIgnore: /lighthouse\.spec\.ts$/,
    },
    {
      // The performance budget of the key pages, measured with the mobile profile of Lighthouse.
      name: 'lighthouse',
      testMatch: /lighthouse\.spec\.ts$/,
      dependencies: ['setup'],
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @trybun/server start',
      url: 'http://localhost:3001/health',
      reuseExistingServer: !isCi,
    },
    {
      command: 'pnpm exec next start --port 3000',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !isCi,
    },
  ],
});
