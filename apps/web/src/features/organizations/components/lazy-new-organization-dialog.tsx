'use client';

import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its form code loads after the first paint (§18.5); the
// server renders its button.
const NewOrganizationDialog = lazy(() =>
  import('./new-organization-dialog.js').then((module) => ({
    default: module.NewOrganizationDialog,
  })),
);

/** The New organization button and dialog, loaded after the first paint. */
export function LazyNewOrganizationDialog() {
  return (
    <Suspense>
      <NewOrganizationDialog />
    </Suspense>
  );
}
