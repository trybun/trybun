'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { RejectDialog as RejectDialogType } from './reject-dialog.js';

// The dialog opens only when the status is chosen, so its code loads then (§18.5).
const RejectDialog = lazy(() =>
  import('./reject-dialog.js').then((module) => ({ default: module.RejectDialog })),
);

/** The reject dialog of the status control, loaded when it is first rendered. */
export function LazyRejectDialog(props: ComponentProps<typeof RejectDialogType>) {
  return (
    <Suspense>
      <RejectDialog {...props} />
    </Suspense>
  );
}
