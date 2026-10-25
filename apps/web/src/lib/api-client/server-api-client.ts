import 'server-only';
import { notFound } from 'next/navigation.js';
import createClient from 'openapi-fetch';
import { cache } from 'react';
import { getAccessToken } from '../auth/session.js';
import { getEnv } from '../env/env.js';
import { ApiError } from '../errors/api-error.js';
import { type ApiClient, dataOf } from './api-client.js';
import type { paths } from './schema.js';

/**
 * The API client of Server Components (§14.4): calls the API directly over the internal network
 * with the access token of the request's session. Responses are never cached across requests,
 * because they depend on the user's permissions (§18.5).
 */
export const getServerApiClient = cache(async (): Promise<ApiClient> => {
  const accessToken = await getAccessToken();
  return createClient<paths>({
    baseUrl: getEnv().apiUrl,
    cache: 'no-store',
    headers: accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` },
  });
});

/**
 * The data of a response for a Server Component: a `404` of the API – a record that does not exist
 * or that the user may not see – shows the not-found page (§18.5).
 */
export async function dataOrNotFound<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  try {
    return await dataOf(result);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }
}
