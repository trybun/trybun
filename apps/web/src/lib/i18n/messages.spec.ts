import { CATALOGUES } from '@trybun/i18n/catalogues';
import { describe, expect, it } from 'vitest';
import { getWebMessages } from './messages.js';

describe('getWebMessages', () => {
  it.each(['en', 'pl'] as const)(
    'returns the %s messages without the server namespaces',
    (locale) => {
      const messages = getWebMessages(locale);

      expect(Object.keys(messages)).not.toContain('emails');
      expect(Object.keys(messages)).not.toContain('keycloak');
      expect(messages.signIn).toEqual(CATALOGUES[locale].signIn);
    },
  );
});
