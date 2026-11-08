/**
 * The request header through which `proxy.ts` passes the path of the opened page to the rendering:
 * layouts do not receive the URL, and the sign-in returns to the page the user opened (Rule 2).
 * The proxy sets it on every page request, so a value sent by the browser never reaches a page.
 */
export const REQUEST_PATH_HEADER = 'x-trybun-request-path';

/** A path of the application with its query, the only target the sign-in returns to. */
export function callbackPathOf(value: string | null | undefined): string {
  return value !== null && value !== undefined && /^\/(?!\/)/.test(value) ? value : '/';
}
