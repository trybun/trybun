import 'server-only';
import type { CurrentUser } from '@trybun/contracts/users';
import createClient from 'openapi-fetch';
import type { paths } from '../api-client/schema.js';

/** What a new sign-in needs of its account. */
export type SignedInAccount = Pick<CurrentUser, 'kind' | 'language' | 'timeZone'>;

/**
 * The account of a new sign-in, from the API (`GET /api/v1/users/me`): its kind for the session
 * lifetimes (§14.4), its language and time zone for their cookies (§13.1); `undefined` when the API
 * does not know the account or is unreachable. Roles and kinds are never read from token claims
 * (§14.4).
 */
export async function signedInAccountOf(
  apiUrl: string,
  accessToken: string,
): Promise<SignedInAccount | undefined> {
  const client = createClient<paths>({
    baseUrl: apiUrl,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  try {
    const { data } = await client.GET('/api/v1/users/me');
    return data === undefined
      ? undefined
      : { kind: data.kind, language: data.language, timeZone: data.timeZone };
  } catch (error) {
    // A network error: the API is unreachable (§17.2).
    if (!(error instanceof TypeError)) {
      throw error;
    }
    return undefined;
  }
}
