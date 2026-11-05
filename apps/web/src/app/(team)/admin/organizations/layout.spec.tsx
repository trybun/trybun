import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyToaster } from '../../../../features/app-shell/components/lazy-toaster.js';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: OrganizationsLayout } = await import('./layout.js');

type Layout = ReactElement<{ messages: Record<string, unknown>; children: ReactElement[] }>;

describe('OrganizationsLayout', () => {
  it('mounts the toast region of the organization views after the page', async () => {
    const element = (await OrganizationsLayout({ children: <h2>Organizations</h2> })) as Layout;

    expect(element.props.children[1]).toMatchObject({ type: LazyToaster });
  });

  it('passes the texts of the organization views and the panel to the browser', async () => {
    const element = (await OrganizationsLayout({ children: <h2>Organizations</h2> })) as Layout;

    expect(element.props.messages).toMatchObject({
      organizations: CATALOGUES.pl.organizations,
      administration: CATALOGUES.pl.administration,
      errors: CATALOGUES.pl.errors,
    });
    expect(Object.keys(element.props.messages)).not.toContain('projects');
  });
});
