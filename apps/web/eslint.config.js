import { join } from 'node:path';
import { nextjs } from '@trybun/eslint-config/nextjs';
import { tailwind } from '@trybun/eslint-config/tailwind';

export default [
  ...nextjs({
    allowedPackages: ['@trybun/contracts', '@trybun/i18n', '@trybun/ui'],
    root: import.meta.dirname,
  }),
  ...tailwind({ entryPoint: join(import.meta.dirname, 'src/app/globals.css') }),
];
