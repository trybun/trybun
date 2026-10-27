import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';
import ProjectsLayout from './layout.js';

describe('ProjectsLayout', () => {
  it('mounts the toast region of the project views after the page', () => {
    const element = ProjectsLayout({ children: <h1>Projects</h1> }) as ReactElement<{
      children: ReactElement[];
    }>;

    expect(element.props.children[1]).toMatchObject({ type: LazyToaster });
  });
});
