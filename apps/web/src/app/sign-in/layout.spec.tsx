import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: SignInLayout } = await import('./layout.js');

describe('SignInLayout', () => {
  it('passes the texts of the sign-in redirect to the browser, without those of other views', async () => {
    const element = (await SignInLayout({ children: <main /> })) as ReactElement<{
      messages: Record<string, unknown>;
    }>;

    expect(element.props.messages).toMatchObject({
      signIn: CATALOGUES.pl.signIn,
      ui: CATALOGUES.pl.ui,
    });
    expect(Object.keys(element.props.messages)).not.toContain('setup');
  });
});
