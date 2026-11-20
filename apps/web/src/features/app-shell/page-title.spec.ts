import { CATALOGUES, type Locale } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
let locale: Locale = 'en';
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'app') =>
    Promise.resolve(createTranslator({ locale, messages: CATALOGUES[locale], namespace })),
}));

const { pageTitle } = await import('./page-title.js');

afterEach(() => {
  locale = 'en';
});

describe('pageTitle', () => {
  it('puts the brand after a single part', async () => {
    await expect(pageTitle('Tickets')).resolves.toEqual({
      title: { absolute: 'Tickets – Trybun' },
    });
  });

  it('keeps the most specific part first and the brand last', async () => {
    await expect(pageTitle('Project settings', 'Website')).resolves.toEqual({
      title: { absolute: 'Project settings – Website – Trybun' },
    });
  });

  it('joins the parts with the separator of the language', async () => {
    locale = 'pl';

    await expect(pageTitle('Konta', 'Administracja')).resolves.toEqual({
      title: { absolute: 'Konta – Administracja – Trybun' },
    });
  });

  it.each(["Price $& and $' x", 'Braces {part} and {rest}', 'Literal %s', "It's <b>bold</b>"])(
    'inserts a record value exactly as typed: %s',
    async (value) => {
      await expect(pageTitle(value, 'Website')).resolves.toEqual({
        title: { absolute: `${value} – Website – Trybun` },
      });
    },
  );
});
