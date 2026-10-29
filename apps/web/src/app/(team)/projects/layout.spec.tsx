import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';

vi.mock('next-intl/server', () => ({ getMessages: () => Promise.resolve(CATALOGUES.pl) }));

const { default: ProjectsLayout } = await import('./layout.js');

type Layout = ReactElement<{ messages: Record<string, unknown>; children: ReactElement[] }>;

describe('ProjectsLayout', () => {
  it('mounts the toast region of the project views after the page', async () => {
    const element = (await ProjectsLayout({ children: <h1>Projects</h1> })) as Layout;

    expect(element.props.children[1]).toMatchObject({ type: LazyToaster });
  });

  it('passes the texts of the project views to the browser', async () => {
    const element = (await ProjectsLayout({ children: <h1>Projects</h1> })) as Layout;

    expect(element.props.messages).toMatchObject({
      projects: CATALOGUES.pl.projects,
      errors: CATALOGUES.pl.errors,
      appShell: CATALOGUES.pl.appShell,
    });
  });
});
