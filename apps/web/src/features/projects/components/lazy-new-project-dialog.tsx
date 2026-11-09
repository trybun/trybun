'use client';

import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its form code loads after the first paint (§18.5); the
// server renders its button.
const NewProjectDialog = lazy(() =>
  import('./new-project-dialog.js').then((module) => ({ default: module.NewProjectDialog })),
);

/** The New project button and dialog, loaded after the first paint. */
export function LazyNewProjectDialog() {
  return (
    <Suspense>
      <NewProjectDialog />
    </Suspense>
  );
}
