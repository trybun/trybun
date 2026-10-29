import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: InvitationsLayout } = await import('./layout.js');

describe('InvitationsLayout', () => {
  it('passes the texts of the acceptance page to the browser, without those of other views', async () => {
    const element = (await InvitationsLayout({ children: <main /> })) as ReactElement<{
      messages: Record<string, unknown>;
    }>;

    expect(element.props.messages).toMatchObject({
      invitations: CATALOGUES.pl.invitations,
      errors: CATALOGUES.pl.errors,
      ui: CATALOGUES.pl.ui,
    });
    expect(Object.keys(element.props.messages)).not.toContain('projects');
  });
});
