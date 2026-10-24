/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The theme of the story tests: `light` or `dark` (vitest.config.ts). */
  readonly STORYBOOK_THEME?: 'light' | 'dark';
}
