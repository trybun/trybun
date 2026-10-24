import type { StorybookConfig } from '@storybook/react-vite';

// The component catalogue of @trybun/ui (§2.6). Vite reads vite.config.ts of this package.
const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-themes',
    '@storybook/addon-vitest',
  ],
  core: { disableTelemetry: true },
};

export default config;
