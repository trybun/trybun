import type { Client } from 'openapi-fetch';
import { apiErrorOf } from '../errors/api-error.js';
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
  if (!response.ok) {
    throw apiErrorOf(response.status, error);
  }
  return data as T;
}
