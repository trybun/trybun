import { nextjs } from '@trybun/eslint-config/nextjs';

export default nextjs({
  allowedPackages: ['@trybun/contracts', '@trybun/i18n', '@trybun/ui'],
  root: import.meta.dirname,
});
