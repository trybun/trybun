import type { Metadata } from 'next';
import { cache } from 'react';
import { GettingStartedChecklist } from '../../../features/administration/components/getting-started-checklist.js';
import { RateLimitedNotice } from '../../../features/app-shell/components/rate-limited-notice.js';
import {
  dataOrNotFound,
  getServerApiClient,
  metadataAfterRead,
  readOrRateLimited,
} from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';

/**
 * The read of the page, shared with its metadata in one request; the API answers a person who is
 * not the Administrator with `404`.
 */
const loadGettingStarted = cache(async () => {
  await requireSession();
  const client = await getServerApiClient();
  return dataOrNotFound(client.GET('/api/v1/administration/getting-started'));
});

/** A person who is not the Administrator gets the translated not-found title of the tab (#404). */
export function generateMetadata(): Promise<Metadata> {
  return metadataAfterRead(loadGettingStarted());
}

/**
 * The landing page of the Administrator panel: the getting-started checklist (§15.6). A person over
 * the rate limit is told so (§14.4).
 */
export default async function GettingStartedPage() {
  const { data: page, rateLimited } = await readOrRateLimited(loadGettingStarted());
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  return <GettingStartedChecklist items={page.items} />;
}
