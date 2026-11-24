import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/**
 * The fragment of the address (`location.hash`, `''` without one), which only the browser knows:
 * `undefined` on the server and in the first render of the hydration, so a page renders its check
 * there (the tokens of the setup and the invitation links, ADR 0009).
 */
export function useLocationHash(): string | undefined {
  return useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => undefined,
  );
}
