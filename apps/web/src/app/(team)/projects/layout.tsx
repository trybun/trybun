import type { ReactNode } from 'react';
import { LazyToaster } from '../../../features/app-shell/components/lazy-toaster.js';

/**
 * The project views and their toasts (e.g. "Project archived" with Undo). The toast region is
 * mounted here, not in the shell of every team view: its code would count towards the Lighthouse
 * budget of the empty shell (§2.9).
 */
export default function ProjectsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <LazyToaster />
    </>
  );
}
