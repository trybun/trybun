import { nestjs } from '@trybun/eslint-config/nestjs';

export default nestjs({
  allowedPackages: ['@trybun/contracts', '@trybun/i18n', '@trybun/markdown'],
  root: import.meta.dirname,
});
