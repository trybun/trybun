'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { RedactionDialog as RedactionDialogType } from './redaction-dialog.js';

// Redaction opens only on request, so its code loads then (§18.5).
const RedactionDialog = lazy(() =>
  import('./redaction-dialog.js').then((module) => ({ default: module.RedactionDialog })),
);

/** The redaction dialog, loaded when it is first rendered. */
export function LazyRedactionDialog(props: ComponentProps<typeof RedactionDialogType>) {
  return (
    <Suspense>
      <RedactionDialog {...props} />
    </Suspense>
  );
}
