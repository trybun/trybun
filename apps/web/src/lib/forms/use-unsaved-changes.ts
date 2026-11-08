'use client';

import { useRouter } from 'next/navigation.js';
import { useEffect, useRef, useState } from 'react';

/** Marks the history entry the guard adds above the page's own entry. */
const GUARD_ENTRY_KEY = '__trybunUnsavedChanges';

/** A component with typed text that would be lost; the latest one asks when Back is pressed. */
interface Guard {
  ask: () => void;
}

/**
 * The browser has one history, so the guards of a page share one entry above the page's own: Back
 * leaves it first, which the guard catches, instead of leaving the page. Module state, because it
 * mirrors `window.history`, which is one per page too.
 */
const guarded = {
  /** The guards whose text is unsaved, the latest last. */
  guards: [] as Guard[],
  /** The guard's entry: its address, and whether it is the current entry. */
  entry: null as { href: string; isCurrent: boolean } | null,
  /** While going back over the guard's entry: what to do once it is left. */
  removal: null as (() => void)[] | null,
  /** Removes the entry after the last guard is gone, unless one comes back (Strict Mode). */
  removalTimer: undefined as ReturnType<typeof setTimeout> | undefined,
  isListening: false,
};

function isGuardEntry(state: unknown): boolean {
  return typeof state === 'object' && state !== null && GUARD_ENTRY_KEY in state;
}

function pushGuardEntry() {
  if (guarded.removal !== null) {
    guarded.removal.push(() => {
      if (guarded.guards.length > 0) {
        pushGuardEntry();
      }
    });
    return;
  }
  if (guarded.entry?.isCurrent === true) {
    return;
  }
  // Next.js keeps its router tree in the state of an entry and restores the page from it, so the
  // guard's entry carries a copy of the page's state.
  const state: unknown = window.history.state;
  window.history.pushState(
    { ...(typeof state === 'object' ? state : {}), [GUARD_ENTRY_KEY]: true },
    '',
  );
  guarded.entry = { href: window.location.href, isCurrent: true };
}

/** Goes back over the guard's entry when it is the current one, then calls `then`. */
function removeGuardEntry(then: () => void = () => undefined) {
  clearTimeout(guarded.removalTimer);
  guarded.removalTimer = undefined;
  if (guarded.removal !== null) {
    guarded.removal.push(then);
    return;
  }
  const entry = guarded.entry;
  guarded.entry = null;
  // After a navigation of Next.js the entry is no longer the current one; it is left in place.
  if (entry?.isCurrent !== true || window.location.href !== entry.href) {
    then();
    return;
  }
  guarded.removal = [then];
  window.history.back();
}

function onPopState(event: PopStateEvent) {
  if (guarded.removal !== null) {
    // The page stays where it is: Next.js has nothing to restore.
    event.stopImmediatePropagation();
    const callbacks = guarded.removal;
    guarded.removal = null;
    for (const callback of callbacks) {
      callback();
    }
    return;
  }
  const entry = guarded.entry;
  if (entry === null || window.location.href !== entry.href) {
    // Another page, or a jump over several entries: Next.js shows it, nobody asks.
    guarded.entry = null;
    return;
  }
  const asker = guarded.guards.at(-1);
  if (asker === undefined) {
    return;
  }
  if (entry.isCurrent) {
    // Back from the guard's entry to the page's own: the page stays and asks.
    entry.isCurrent = false;
    event.stopImmediatePropagation();
    asker.ask();
  } else if (isGuardEntry(event.state)) {
    // Forward onto the guard's entry again.
    entry.isCurrent = true;
    event.stopImmediatePropagation();
  }
}

function addGuard(guard: Guard) {
  if (!guarded.isListening) {
    // In the capture phase, the listener runs before the one of Next.js on `window` and can keep
    // it from restoring the page.
    window.addEventListener('popstate', onPopState, true);
    guarded.isListening = true;
  }
  clearTimeout(guarded.removalTimer);
  guarded.removalTimer = undefined;
  guarded.guards.push(guard);
  pushGuardEntry();
}

function deleteGuard(guard: Guard) {
  const index = guarded.guards.indexOf(guard);
  if (index !== -1) {
    guarded.guards.splice(index, 1);
  }
}

function removeGuard(guard: Guard) {
  deleteGuard(guard);
  if (guarded.guards.length === 0 && guarded.entry !== null) {
    guarded.removalTimer ??= setTimeout(() => {
      if (guarded.guards.length === 0) {
        removeGuardEntry();
      }
    }, 0);
  }
}

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

type Question = { kind: 'link'; href: string } | { kind: 'back' };

/**
 * Asks before typed text is lost (S1-10 Q10, §18.5): while `isDirty`, closing or reloading the tab
 * gets the browser's own question, while a link of the application and the browser's Back button
 * (and the back gesture of a phone) are held back – `isAsking` – until the person decides in the
 * component's confirmation: `leave()` leaves, `stay()` keeps the text. A link is caught before
 * Next.js handles its press; Back leaves an entry the guard adds to the history above the page's
 * own, so the page never changes first. A component that leaves after saving calls
 * `navigate(href)`, which takes that entry back without asking.
 */
export function useUnsavedChanges(isDirty: boolean) {
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const guard = useRef<Guard | null>(null);
  const isReleased = useRef(false);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    isReleased.current = false;
    const current: Guard = { ask: () => setQuestion({ kind: 'back' }) };
    guard.current = current;
    addGuard(current);
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isReleased.current) {
        return;
      }
      event.preventDefault();
      // Browsers before the standard `preventDefault()` ask only with a `returnValue`.
      event.returnValue = '';
    };
    const onClick = (event: MouseEvent) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(anchor instanceof HTMLAnchorElement) || isOutsideOfPage(event, anchor)) {
        return;
      }
      const url = new URL(anchor.href);
      const page = new URL(window.location.href);
      // Another site unloads the page, which the browser asks about; a link within the page
      // (e.g. "Skip to content") leaves nothing.
      if (url.origin !== page.origin || (url.pathname === page.pathname && url.hash !== '')) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setQuestion({ kind: 'link', href: `${url.pathname}${url.search}${url.hash}` });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    // The capture phase of the document runs before React's listeners of `next/link`.
    document.addEventListener('click', onClick, true);
    return () => {
      removeGuard(current);
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [isDirty]);

  /** Stops asking: the text is left on purpose. */
  const release = () => {
    isReleased.current = true;
    if (guard.current !== null) {
      deleteGuard(guard.current);
    }
  };

  const navigate = (href: string) => {
    release();
    if (guarded.guards.length === 0) {
      removeGuardEntry(() => router.push(href));
    } else {
      router.push(href);
    }
  };

  return {
    isAsking: question !== null,
    leave: () => {
      setQuestion(null);
      if (question?.kind === 'link') {
        navigate(question.href);
      } else if (question?.kind === 'back') {
        release();
        // Back again, past the page's own entry – or two back, when Forward returned onto the
        // guard's entry meanwhile.
        const steps = guarded.entry?.isCurrent === true ? -2 : -1;
        guarded.entry = null;
        window.history.go(steps);
      }
    },
    stay: () => {
      setQuestion(null);
      if (question?.kind === 'back' && !isReleased.current && guarded.guards.length > 0) {
        pushGuardEntry();
      }
    },
    /** Leaves for `href` without asking – after a save – and takes the guard's entry back first. */
    navigate,
  };
}
