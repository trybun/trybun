import { join } from 'node:path';
import { library } from '@trybun/eslint-config/library';
import { react } from '@trybun/eslint-config/react';
import { tailwind } from '@trybun/eslint-config/tailwind';

export default [
  ...library({ allowedPackages: ['@trybun/i18n', '@trybun/ui'] }),
  ...react,
  ...tailwind({ entryPoint: join(import.meta.dirname, 'src/styles/globals.css') }),
];
