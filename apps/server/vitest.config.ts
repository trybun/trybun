import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // SWC emits the decorator metadata NestJS dependency injection needs.
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    name: 'server',
    include: ['src/**/*.spec.ts'],
    exclude: ['**/*.integration.spec.ts'],
  },
});
