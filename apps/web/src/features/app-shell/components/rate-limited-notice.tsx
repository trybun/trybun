import { headers } from 'next/headers.js';
import { callbackPathOf, REQUEST_PATH_HEADER } from '../../../lib/auth/callback-path.js';
import type { ApiError } from '../../../lib/errors/api-error.js';
import { RateLimitedMessage } from './rate-limited-message.js';

/**
 * Shown instead of a page's content when the API answers with `429` (§14.4): the person learns
 * that they sent too many requests and, from `Retry-After`, when to try again – never the
 * not-found page, which would say that the page or the permission is gone (#356). Server
 * Components render it themselves, because an error that reaches `error.tsx` arrives there without
 * its code in production (§18.5). **Reload page** opens the address of the request again
 * (`RateLimitedMessage`). The heading continues the outline of the page: `2` inside a layout that
 * has the `h1` (the Administrator panel).
 */
export async function RateLimitedNotice({
  error,
  headingLevel = 1,
}: {
  error: ApiError;
  headingLevel?: 1 | 2;
}) {
  const requestHeaders = await headers();
  return (
    <RateLimitedMessage
      retryAfterSeconds={error.retryAfterSeconds}
      headingLevel={headingLevel}
      reloadHref={callbackPathOf(requestHeaders.get(REQUEST_PATH_HEADER))}
    />
  );
}
