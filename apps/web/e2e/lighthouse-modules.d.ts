// The median run of Lighthouse, which its package does not list among its entry points. Its own
// declarations name the global `LH` namespace without importing it, so TypeScript cannot resolve
// their types; this declaration gives it the types of the entry point of Lighthouse.

declare module 'lighthouse/core/lib/median-run.js' {
  import type { Result } from 'lighthouse';

  /** The run closest to the median First Contentful Paint and Time to Interactive. */
  export function computeMedianRun(runs: Result[]): Result;
}
