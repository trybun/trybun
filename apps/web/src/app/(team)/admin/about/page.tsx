import type { Metadata } from 'next';
import { cache } from 'react';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { AboutDetails } from '../../../../features/administration/components/about-details.js';
import {
  dataOrNotFound,
  getServerApiClient,
  metadataAfterRead,
  readOrRateLimited,
} from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';

/**
 * The read of the page, shared with its metadata in one request; the API answers a person who is
 * not the Administrator with `404`.
 */
const loadAbout = cache(async () => {
  await requireSession();
  const client = await getServerApiClient();
  return dataOrNotFound(client.GET('/api/v1/administration/about'));
});

/** A person who is not the Administrator gets the translated not-found title of the tab (#404). */
export function generateMetadata(): Promise<Metadata> {
  return metadataAfterRead(loadAbout());
}

/** The "About" page of the Administrator panel (§15.4); a person over the rate limit is told so. */
export default async function AboutPage() {
  const { data: about, rateLimited } = await readOrRateLimited(loadAbout());
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  return <AboutDetails about={about} />;
}
