'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { RevisionsDialog as RevisionsDialogType } from './revisions-dialog.js';

// The history opens only on request, so its code loads then (§18.5).
const RevisionsDialog = lazy(() =>
  import('./revisions-dialog.js').then((module) => ({ default: module.RevisionsDialog })),
);

/** The edit history dialog, loaded when it is first rendered. */
export function LazyRevisionsDialog(props: ComponentProps<typeof RevisionsDialogType>) {
  return (
    <Suspense>
      <RevisionsDialog {...props} />
    </Suspense>
  );
}
