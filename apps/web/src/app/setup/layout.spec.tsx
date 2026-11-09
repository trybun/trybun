import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: SetupLayout } = await import('./layout.js');

describe('SetupLayout', () => {
  it('passes the texts of the first-run wizard to the browser, without those of other views', async () => {
    const element = (await SetupLayout({ children: <main /> })) as ReactElement<{
      messages: Record<string, unknown>;
    }>;

    expect(element.props.messages).toMatchObject({
      setup: CATALOGUES.pl.setup,
      ui: CATALOGUES.pl.ui,
    });
    expect(Object.keys(element.props.messages)).not.toContain('projects');
  });
});
