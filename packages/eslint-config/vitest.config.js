import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'eslint-config',
    include: ['src/**/*.spec.js'],
  },
});
