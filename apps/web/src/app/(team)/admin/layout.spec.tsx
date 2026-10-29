import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getMessages: () => Promise.resolve(CATALOGUES.pl),
  getTranslations: () => Promise.resolve((key: string) => `administration.${key}`),
}));

const { default: AdministrationLayout } = await import('./layout.js');

describe('AdministrationLayout', () => {
  it('passes the texts of the Administrator panel and the shell to the browser', async () => {
    const element = (await AdministrationLayout({ children: <main /> })) as ReactElement<{
      messages: Record<string, unknown>;
    }>;

    expect(element.props.messages).toMatchObject({
      administration: CATALOGUES.pl.administration,
      appShell: CATALOGUES.pl.appShell,
    });
    expect(Object.keys(element.props.messages)).not.toContain('projects');
  });
});
