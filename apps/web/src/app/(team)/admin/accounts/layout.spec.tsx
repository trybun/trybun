import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyToaster } from '../../../../features/app-shell/components/lazy-toaster.js';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: AccountsLayout } = await import('./layout.js');

type Layout = ReactElement<{ messages: Record<string, unknown>; children: ReactElement[] }>;

describe('AccountsLayout', () => {
  it('mounts the toast region of the Accounts page after the page', async () => {
    const element = (await AccountsLayout({ children: <h2>Accounts</h2> })) as Layout;

    expect(element.props.children[1]).toMatchObject({ type: LazyToaster });
  });

  it('passes the texts of the accounts and the panel to the browser', async () => {
    const element = (await AccountsLayout({ children: <h2>Accounts</h2> })) as Layout;

    expect(element.props.messages).toMatchObject({
      users: CATALOGUES.pl.users,
      administration: CATALOGUES.pl.administration,
      errors: CATALOGUES.pl.errors,
    });
    expect(Object.keys(element.props.messages)).not.toContain('organizations');
  });
});
