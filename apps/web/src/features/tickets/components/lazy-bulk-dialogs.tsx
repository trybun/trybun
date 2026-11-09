'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { BulkChangeResultDialog as BulkChangeResultDialogType } from './bulk-change-result-dialog.js';
import type { BulkRejectDialog as BulkRejectDialogType } from './bulk-reject-dialog.js';

// The dialogs open only after a bulk action, so their code loads then (§18.5).
const BulkRejectDialog = lazy(() =>
  import('./bulk-reject-dialog.js').then((module) => ({ default: module.BulkRejectDialog })),
);
const BulkChangeResultDialog = lazy(() =>
  import('./bulk-change-result-dialog.js').then((module) => ({
    default: module.BulkChangeResultDialog,
  })),
);

/** The reason dialog of a bulk rejection, loaded when it is first rendered. */
export function LazyBulkRejectDialog(props: ComponentProps<typeof BulkRejectDialogType>) {
  return (
    <Suspense>
      <BulkRejectDialog {...props} />
    </Suspense>
  );
}

/** The result dialog of a bulk change, loaded when it is first rendered. */
export function LazyBulkChangeResultDialog(
  props: ComponentProps<typeof BulkChangeResultDialogType>,
) {
  return (
    <Suspense>
      <BulkChangeResultDialog {...props} />
    </Suspense>
  );
}
