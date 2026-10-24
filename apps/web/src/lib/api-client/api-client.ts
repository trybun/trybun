import type { Client } from 'openapi-fetch';
import type { paths } from './schema.js';

/**
 * The typed client of the API, generated from its OpenAPI document (§14.2, §18.5): the server API
 * client in Server Components, the browser API client through the BFF in client components.
 */
export type ApiClient = Client<paths>;

/** The data of a successful response of the API; a failed one throws its `ApiError` (§18.5). */
export async function dataOf<T>(
  result: Promise<{ data?: T; error?: unknown; response: Response }>,
): Promise<T> {
  const { data, error, response } = await result;
  if (response.ok) {
    return data as T;
  }
  // The reading of Problem Details (with Zod) is loaded only when a request fails, so that it is
  // not part of the code every page loads first (§2.9).
  const { apiErrorOf } = await import('../errors/api-error.js');
  throw apiErrorOf(response.status, error);
}
