'use client';

import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its code loads after the first paint (§18.5); the server
// renders its button.
const AddMemberDialog = lazy(() =>
  import('./add-member-dialog.js').then((module) => ({ default: module.AddMemberDialog })),
);

/** The Add member button and dialog, loaded after the first paint. */
export function LazyAddMemberDialog({ projectId }: { projectId: string }) {
  return (
    <Suspense>
      <AddMemberDialog projectId={projectId} />
    </Suspense>
  );
}
