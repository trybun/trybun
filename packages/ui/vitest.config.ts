import { join } from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig, mergeConfig, type ViteUserConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

/** Every story as a test in Chromium, with the accessibility check, in the given theme (§13.4). */
function storyTests(theme: 'light' | 'dark'): ViteUserConfig {
  return mergeConfig(viteConfig, {
    plugins: [storybookTest({ configDir: join(import.meta.dirname, '.storybook') })],
    define: { 'import.meta.env.STORYBOOK_THEME': JSON.stringify(theme) },
    test: {
      name: `ui-stories-${theme}`,
      browser: {
        enabled: true,
        headless: true,
        provider: playwright(),
        instances: [{ browser: 'chromium' }],
      },
    },
  });
}

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'ui', include: ['src/**/*.spec.ts'] } },
      storyTests('light'),
      storyTests('dark'),
    ],
  },
});
