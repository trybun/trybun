'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { FieldSheet as FieldSheetType } from './field-sheet.js';

// A field's bottom sheet opens only on request, so its code loads then (§18.5).
const FieldSheet = lazy(() =>
  import('./field-sheet.js').then((module) => ({ default: module.FieldSheet })),
);

/** The bottom sheet of a field on phones, loaded when it is first rendered. */
export function LazyFieldSheet(props: ComponentProps<typeof FieldSheetType>) {
  return (
    <Suspense>
      <FieldSheet {...props} />
    </Suspense>
  );
}
