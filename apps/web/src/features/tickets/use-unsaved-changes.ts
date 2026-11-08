'use client';

import { useRouter } from 'next/navigation.js';
import { useEffect, useState } from 'react';

/** Whether a click opens a link in a new tab or window, or downloads it, so nothing is left. */
function isOutsideOfPage(event: MouseEvent, anchor: HTMLAnchorElement): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (anchor.target !== '' && anchor.target !== '_self') ||
    anchor.hasAttribute('download')
  );
}

/**
 * Asks before typed text is lost (S1-10 Q10): while `isDirty`, closing or reloading the tab gets
 * the browser's own question, and a link of the application is held back – `pendingHref` – until
 * the person decides in the component's confirmation: `leave()` follows it, `stay()` keeps the
 * text. The link is caught before Next.js handles its press, so the page never changes first.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || isOutsideOfPage(event, anchor)) {
        return;
      }
      const url = new URL(anchor.href);
      const current = new URL(window.location.href);
      // Another site unloads the page, which the browser asks about; a link within the page
      // (e.g. "Skip to content") leaves nothing.
      if (url.origin !== current.origin || (url.pathname === current.pathname && url.hash !== '')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(`${url.pathname}${url.search}${url.hash}`);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // The capture phase of the document runs before React's listeners of `next/link`.
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [isDirty]);

  return {
    pendingHref,
    leave: () => {
      if (pendingHref !== null) {
        router.push(pendingHref);
      }
      setPendingHref(null);
    },
    stay: () => setPendingHref(null),
  };
}
