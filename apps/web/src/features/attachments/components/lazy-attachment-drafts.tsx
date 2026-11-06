'use client';

import { type ComponentProps, lazy, Suspense } from 'react';
import type { AttachmentDrafts as AttachmentDraftsType } from './attachment-drafts.js';

// The list appears only once a file is added, so its code loads then (§18.5).
const AttachmentDrafts = lazy(() =>
  import('./attachment-drafts.js').then((module) => ({ default: module.AttachmentDrafts })),
);

/** The drafts of a form, loaded when the first file is added. */
export function LazyAttachmentDrafts(props: ComponentProps<typeof AttachmentDraftsType>) {
  if (props.drafts.length === 0) {
    return null;
  }
  return (
    <Suspense>
      <AttachmentDrafts {...props} />
    </Suspense>
  );
}
