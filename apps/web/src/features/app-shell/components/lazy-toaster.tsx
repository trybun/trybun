'use client';

import { lazy, Suspense } from 'react';

// Toasts appear only after an action, so the toast region and its code load after the first
// paint (§18.5). Messages are added through the `toast` manager of `@trybun/ui`, which this
// region shows.
const Toaster = lazy(() =>
  import('@trybun/ui/components/toast').then((module) => ({ default: module.Toaster })),
);

/** The region of the toasts of the team views, e.g. "Project archived" with Undo (§18.5). */
export function LazyToaster() {
  return (
    <Suspense>
      <Toaster />
    </Suspense>
  );
}
