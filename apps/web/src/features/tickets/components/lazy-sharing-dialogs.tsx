'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type {
  RefuseSharingDialog as RefuseSharingDialogType,
  ShareDialog as ShareDialogType,
} from './sharing-dialogs.js';

// The dialogs open only when the team shares or refuses, so their code loads then (§18.5).
const ShareDialog = lazy(() =>
  import('./sharing-dialogs.js').then((module) => ({ default: module.ShareDialog })),
);
const RefuseSharingDialog = lazy(() =>
  import('./sharing-dialogs.js').then((module) => ({ default: module.RefuseSharingDialog })),
);

/** The share dialog of the visibility control, loaded when it is first rendered. */
export function LazyShareDialog(props: ComponentProps<typeof ShareDialogType>) {
  return (
    <Suspense>
      <ShareDialog {...props} />
    </Suspense>
  );
}

/** The refuse dialog of the visibility control, loaded when it is first rendered. */
export function LazyRefuseSharingDialog(props: ComponentProps<typeof RefuseSharingDialogType>) {
  return (
    <Suspense>
      <RefuseSharingDialog {...props} />
    </Suspense>
  );
}
