import 'server-only';
import { cookies } from 'next/headers.js';
import { getEnv } from '../../lib/env/env.js';

/** The cookie that remembers the collapsed side navigation on desktop in this browser (§2.9). */
export const NAVIGATION_COLLAPSED_COOKIE = 'TRYBUN_NAVIGATION_COLLAPSED';

const NAVIGATION_COLLAPSED_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Stores the desktop choice of the side navigation in the cookie of the response (§18.5):
 * collapsed sets it, expanded – the default – removes it.
 */
export async function storeNavigationCollapsed(isCollapsed: boolean): Promise<void> {
  const cookieStore = await cookies();
  if (!isCollapsed) {
    cookieStore.delete(NAVIGATION_COLLAPSED_COOKIE);
    return;
  }
  cookieStore.set(NAVIGATION_COLLAPSED_COOKIE, '1', {
    path: '/',
    maxAge: NAVIGATION_COLLAPSED_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: getEnv().shouldUseSecureCookies,
  });
}

/** Whether this browser collapsed the side navigation on desktop; any other value is expanded. */
export async function isNavigationCollapsed(): Promise<boolean> {
  return (await cookies()).get(NAVIGATION_COLLAPSED_COOKIE)?.value === '1';
}
