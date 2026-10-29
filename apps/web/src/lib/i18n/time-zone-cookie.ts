import 'server-only';
import { isTimeZone } from '@trybun/i18n/time-zones';
import { cookies } from 'next/headers.js';
import { getEnv } from '../env/env.js';

/** The cookie with the time zone of the signed-in account (§13.1). */
export const TIME_ZONE_COOKIE = 'TRYBUN_TIME_ZONE';

const TIME_ZONE_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

/**
 * Stores the time zone of the account in the time-zone cookie of the response (§13.1): at
 * sign-in and when the account settings are saved; `null` – the system default – removes it.
 */
export async function storeTimeZone(timeZone: string | null): Promise<void> {
  const cookieStore = await cookies();
  if (timeZone === null || !isTimeZone(timeZone)) {
    cookieStore.delete(TIME_ZONE_COOKIE);
    return;
  }
  cookieStore.set(TIME_ZONE_COOKIE, timeZone, {
    path: '/',
    maxAge: TIME_ZONE_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
    secure: getEnv().shouldUseSecureCookies,
  });
}

/** The time zone of the current request: the account's, else the system default (§13.1). */
export async function getRequestTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return value !== undefined && isTimeZone(value) ? value : getEnv().defaultTimeZone;
}
