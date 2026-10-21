import { library } from '@trybun/eslint-config/library';
import { react } from '@trybun/eslint-config/react';

export default [...library({ allowedPackages: ['@trybun/i18n'] }), ...react];
