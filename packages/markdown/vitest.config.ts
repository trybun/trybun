import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'markdown',
    include: ['src/**/*.spec.ts'],
  },
});
