'use client';

import { useRouter } from 'next/navigation.js';
import { useEffect } from 'react';
import { ApiError } from '../../lib/errors/api-error.js';

/**
 * Whether the record of a page is isGone in the browser – the query of its Server Component answers
 * `404` because the record was deleted or became invisible while the page was open (§18.5, #404).
 * Then the route is refreshed: its Server Component reads the record again and calls `notFound()`
 * in its `generateMetadata` and page, so the not-found page comes with its translated tab title. A
 * `notFound()` called in the browser shows the not-found page but keeps the title of the page.
 */
export function useNotFoundOnServer(error: unknown): boolean {
  const router = useRouter();
  const isGone = error instanceof ApiError && error.status === 404;
  useEffect(() => {
    if (isGone) {
      router.refresh();
    }
  }, [isGone, router]);
  return isGone;
}
