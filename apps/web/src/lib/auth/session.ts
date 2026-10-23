import 'server-only';
import { getServerSession, type Session } from 'next-auth';
import { redirect } from 'next/navigation.js';
import { connection } from 'next/server.js';
import { cache } from 'react';
import { createAuthOptions, SIGN_IN_PATH } from './auth-options.js';

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
