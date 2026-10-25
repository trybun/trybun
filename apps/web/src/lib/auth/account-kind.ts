import 'server-only';
import type { UserKind } from '@trybun/contracts/users';
import createClient from 'openapi-fetch';
import type { paths } from '../api-client/schema.js';

/**
 * The kind of the account of a new sign-in, from the API (`GET /api/v1/users/me`), for the session
 * lifetimes (§14.4); `undefined` when the API does not know the account or is unreachable. Roles
 * and kinds are never read from token claims (§14.4).
 */
export async function accountKindOf(
  apiUrl: string,
  accessToken: string,
): Promise<UserKind | undefined> {
  const client = createClient<paths>({
    baseUrl: apiUrl,
    cache: 'no-store',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  try {
    const { data } = await client.GET('/api/v1/users/me');
    return data?.kind;
  } catch (error) {
    // A network error: the API is unreachable (§17.2).
    if (!(error instanceof TypeError)) {
      throw error;
    }
    return undefined;
  }
}
