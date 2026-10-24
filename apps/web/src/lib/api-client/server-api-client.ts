import 'server-only';
import createClient from 'openapi-fetch';
import { cache } from 'react';
import { getAccessToken } from '../auth/session.js';
import { getEnv } from '../env/env.js';
import type { ApiClient } from './api-client.js';
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
