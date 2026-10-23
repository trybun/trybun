import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web',
    include: ['src/**/*.spec.{ts,tsx}'],
    exclude: ['**/*.integration.spec.{ts,tsx}'],
  },
});
