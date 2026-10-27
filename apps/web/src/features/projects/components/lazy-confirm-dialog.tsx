'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { ConfirmDialog as ConfirmDialogType } from './confirm-dialog.js';

// A confirmation opens only on request, so the dialog code loads then (§18.5).
const ConfirmDialog = lazy(() =>
  import('./confirm-dialog.js').then((module) => ({ default: module.ConfirmDialog })),
);

/** The confirmation dialog, loaded when it is first rendered. */
export function LazyConfirmDialog(props: ComponentProps<typeof ConfirmDialogType>) {
  return (
    <Suspense>
      <ConfirmDialog {...props} />
    </Suspense>
  );
}
