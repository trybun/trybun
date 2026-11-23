'use client';

import type { FetchStatus } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

/**
 * Shown by a list in place of its rows while the browser reads its query without data yet – the
 * prefetch of the server failed, a first read in the browser, a new search (§18.5, #427, #428):
 * never its empty table or its empty state, which look like "no records". A visible text in a
 * `role="status"` element, announced politely (WCAG 2.2 SC 4.1.3). While the browser is offline,
 * TanStack Query pauses the read (`fetchStatus: 'paused'`) until the connection returns, so the
 * status says that instead of `children`, the list's own loading text.
 */
export function LoadingStatus({
  fetchStatus,
  children,
}: {
  fetchStatus: FetchStatus;
  children: ReactNode;
}) {
  const t = useTranslations('appShell');
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {fetchStatus === 'paused' ? t('waitingForConnection') : children}
    </p>
  );
}
