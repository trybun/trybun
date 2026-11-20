import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { AboutDetails } from '../../../../features/administration/components/about-details.js';
import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { pageTitle } from '../../../../features/app-shell/page-title.js';
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

/**
 * The tab title names the section of the Administrator panel (§13.4); a person who is not the
 * Administrator gets the translated not-found title (#404).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('administration');
  const title = () => pageTitle(t('about'), t('title'));
  return metadataAfterRead(loadAbout(), { title, rateLimitedTitle: title });
}

/** The "About" page of the Administrator panel (§15.4); a person over the rate limit is told so. */
export default async function AboutPage() {
  const { data: about, rateLimited } = await readOrRateLimited(loadAbout());
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  return <AboutDetails about={about} />;
}
