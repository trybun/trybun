'use client';

import type { MarkdownEditorProps } from '@trybun/ui/components/markdown-editor';
import { lazy, Suspense } from 'react';

// The editor's toolbar, tabs and Markdown preview load after the first paint (§18.5, S1-07).
const MarkdownEditor = lazy(() =>
  import('@trybun/ui/components/markdown-editor').then((module) => ({
    default: module.MarkdownEditor,
  })),
);

/** The GFM editor of S1-07 for the ticket forms, loaded after the first paint. */
export function LazyMarkdownEditor(props: MarkdownEditorProps) {
  return (
    <Suspense
      fallback={<div aria-hidden className="min-h-48 rounded-lg border border-input bg-muted/30" />}
    >
      <MarkdownEditor {...props} />
    </Suspense>
  );
}
