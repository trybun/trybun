'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { DuplicateDialog as DuplicateDialogType } from './duplicate-dialog.js';

// The dialog opens only when the status is chosen, so its code loads then (§18.5).
const DuplicateDialog = lazy(() =>
  import('./duplicate-dialog.js').then((module) => ({ default: module.DuplicateDialog })),
);

/** The duplicate dialog of the status control, loaded when it is first rendered. */
export function LazyDuplicateDialog(props: ComponentProps<typeof DuplicateDialogType>) {
  return (
    <Suspense>
      <DuplicateDialog {...props} />
    </Suspense>
  );
}
