import 'server-only';
import { getServerSession, type Session } from 'next-auth';
import { cookies } from 'next/headers.js';
import { redirect } from 'next/navigation.js';
import { connection } from 'next/server.js';
import { cache } from 'react';
import {
  createAuthOptions,
  getAccessTokens,
  SIGN_IN_PATH,
  sessionCookieName,
} from './auth-options.js';

/**
 * The session of the request, read once per request (§18.5). Its row is looked up on every
 * request, so a deleted session row signs the user out at once (§14.4).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // A request-time read: never during the build, whose environment is not the runtime one.
  await connection();
  return getServerSession(createAuthOptions());
});

/** The session of the request; without one, the user is sent to the sign-in. */
export async function requireSession(callbackPath = '/'): Promise<Session> {
  const session = await getSession();
  if (session === null) {
    return redirect(
      `${SIGN_IN_PATH}?${new URLSearchParams({ callbackUrl: callbackPath }).toString()}`,
    );
  }
  return session;
}

/**
 * The access token of the request's session for the API, refreshed when it is about to expire;
 * `undefined` without a session (§14.4). Read once per request, like the session.
 */
export const getAccessToken = cache(async (): Promise<string | undefined> => {
  await connection();
  const sessionToken = (await cookies()).get(sessionCookieName())?.value;
  return sessionToken === undefined ? undefined : getAccessTokens().forSession(sessionToken);
});
