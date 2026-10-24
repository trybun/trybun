import 'client-only';
import createClient from 'openapi-fetch';
import type { ApiClient } from './api-client.js';
import type { paths } from './schema.js';

/**
 * The API client of client components: the BFF endpoint `/api/v1/*` of the same origin, which
 * attaches the session's token on the server (§14.4). The browser sends only the session cookie.
 */
export const browserApiClient: ApiClient = createClient<paths>({ baseUrl: '' });
