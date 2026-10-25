/**
 * The token of the setup link `https://<domain>/setup#token=<token>` (§15.6): in the fragment, so
 * it never reaches a server log; `''` for a link without one.
 */
export function setupTokenOf(hash: string): string {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') ?? '';
}

/** The IANA time zones the browser knows, for the time zone of the Administrator (§13.1). */
export function timeZones(): string[] {
  const zones = Intl.supportedValuesOf('timeZone');
  return zones.includes('UTC') ? zones : ['UTC', ...zones];
}
