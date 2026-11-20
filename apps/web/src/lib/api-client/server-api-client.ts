import 'server-only';
import type { Metadata } from 'next';
import { headers } from 'next/headers.js';
import { notFound } from 'next/navigation.js';
import createClient from 'openapi-fetch';
import { cache } from 'react';
import { getAccessToken } from '../auth/session.js';
import { getEnv } from '../env/env.js';
import { ApiError, isRateLimited } from '../errors/api-error.js';
import { type ApiClient, dataOf } from './api-client.js';
import type { paths } from './schema.js';

/**
 * The API client of Server Components (§14.4): calls the API directly over the internal network
 * with the access token of the request's session, and with the client IP that Caddy set for the
 * rate limits of the public endpoints. Responses are never cached across requests, because they
 * depend on the user's permissions (§18.5).
 */
export const getServerApiClient = cache(async (): Promise<ApiClient> => {
  const accessToken = await getAccessToken();
  const forwardedFor = (await headers()).get('x-forwarded-for');
  return createClient<paths>({
    baseUrl: getEnv().apiUrl,
    cache: 'no-store',
    headers: {
      ...(accessToken === undefined ? {} : { Authorization: `Bearer ${accessToken}` }),
      ...(forwardedFor === null ? {} : { 'X-Forwarded-For': forwardedFor }),
    },
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

/**
 * A read of a Server Component whose `429` the page shows instead of its content (§14.4, §18.5):
 * the rate limit is an expected error, returned as a value, as `error.tsx` would receive it
 * without its code in production. Every other error – `notFound()` of `dataOrNotFound()` too –
 * is thrown on.
 */
export async function readOrRateLimited<T>(
  read: Promise<T>,
): Promise<{ data: T; rateLimited?: undefined } | { data?: undefined; rateLimited: ApiError }> {
  try {
    return { data: await read };
  } catch (error) {
    if (isRateLimited(error)) {
      return { rateLimited: error };
    }
    throw error;
  }
}

/**
 * The `generateMetadata` of a page that can show the not-found page (§18.5, #404): it awaits the
 * read of the page – memoized with React `cache()`, so the page and its metadata share one read –
 * and a `notFound()` of the read then reaches the metadata, where Next.js 16 serves the metadata of
 * the `not-found.tsx` for a page load and a client-side navigation alike. A `notFound()` the page
 * calls only while rendering keeps the metadata of its layouts. Every error other than a `429` is
 * thrown on, as the page throws it.
 *
 * The tab title (§13.4): `title` names the record from the data of the read, and runs only after
 * the read was found – so an invisible record never reaches the metadata (§14.4); on a `429`,
 * which the page shows as `RateLimitedNotice`, `rateLimitedTitle` names the page without the
 * record, which was not read.
 */
export async function metadataAfterRead<T>(
  read: Promise<T>,
  {
    title,
    rateLimitedTitle,
  }: { title: (data: T) => Promise<Metadata>; rateLimitedTitle: () => Promise<Metadata> },
): Promise<Metadata> {
  const { data, rateLimited } = await readOrRateLimited(read);
  return rateLimited === undefined ? title(data) : rateLimitedTitle();
}
