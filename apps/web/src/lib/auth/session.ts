import 'server-only';
import { getServerSession, type Session } from 'next-auth';
import { cookies, headers } from 'next/headers.js';
import { redirect } from 'next/navigation.js';
import { connection } from 'next/server.js';
import { cache } from 'react';
import {
  createAuthOptions,
  getAccessTokens,
  SIGN_IN_PATH,
  sessionCookieName,
} from './auth-options.js';
import { callbackPathOf, REQUEST_PATH_HEADER } from './callback-path.js';

/**
 * The session of the request, read once per request (§18.5). Its row is looked up on every
 * request, so a deleted session row signs the user out at once (§14.4).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  // A request-time read: never during the build, whose environment is not the runtime one.
  await connection();
  return getServerSession(createAuthOptions());
});

/**
 * The session of the request; without one, the user is sent to the sign-in, which returns to
 * the page the user opened, passed on by `proxy.ts`.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session === null) {
    const callbackUrl = callbackPathOf((await headers()).get(REQUEST_PATH_HEADER));
    return redirect(`${SIGN_IN_PATH}?${new URLSearchParams({ callbackUrl }).toString()}`);
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
