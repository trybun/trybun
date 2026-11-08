/** The two sides of the web application: the team views and the end-user portal (§5.7). */
export type Shell = 'team' | 'portal';

/**
 * The counterparts of the team and portal routes (§5.7, change specification of S1-09, Q1, Q17,
 * Q18), used in both directions: an account on the wrong side goes to the counterpart of the
 * route it opened. A segment in square brackets carries its value over.
 */
const COUNTERPARTS: readonly Readonly<Record<Shell, string>>[] = [
  { team: '/', portal: '/portal' },
  { team: '/projects/[projectId]', portal: '/portal/projects/[projectId]' },
  { team: '/tickets/[identifier]', portal: '/portal/tickets/[identifier]' },
  { team: '/settings', portal: '/portal/settings' },
];

/** The root of each side, the target of every route without a counterpart. */
const ROOTS: Readonly<Record<Shell, string>> = { team: '/', portal: '/portal' };

/** The values of the bracketed segments of a route in a path, or `undefined` when it does not match. */
function matchRoute(route: string, pathname: string): Record<string, string> | undefined {
  const routeSegments = route.split('/');
  const pathSegments = pathname.split('/');
  if (routeSegments.length !== pathSegments.length) {
    return undefined;
  }
  const values: Record<string, string> = {};
  for (const [index, segment] of routeSegments.entries()) {
    const value = pathSegments[index] ?? '';
    if (segment.startsWith('[') && segment.endsWith(']')) {
      if (value === '') {
        return undefined;
      }
      values[segment] = value;
    } else if (segment !== value) {
      return undefined;
    }
  }
  return values;
}

/**
 * The route of the side `target` that corresponds to a path of the other side; the root of
 * `target` when the path has no counterpart. The query of the path is not carried over.
 */
export function counterpartOf(path: string, target: Shell): string {
  const source: Shell = target === 'team' ? 'portal' : 'team';
  const pathname = path.split(/[?#]/, 1)[0] ?? '/';
  for (const counterpart of COUNTERPARTS) {
    const values = matchRoute(counterpart[source], pathname);
    if (values === undefined) {
      continue;
    }
    return counterpart[target]
      .split('/')
      .map((segment) => values[segment] ?? segment)
      .join('/');
  }
  return ROOTS[target];
}
