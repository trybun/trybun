import { RateLimitedNotice } from '../../../../features/app-shell/components/rate-limited-notice.js';
import { AboutDetails } from '../../../../features/administration/components/about-details.js';
import {
  dataOrNotFound,
  getServerApiClient,
  readOrRateLimited,
} from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';

/** The "About" page of the Administrator panel (§15.4); a person over the rate limit is told so. */
export default async function AboutPage() {
  await requireSession();
  const client = await getServerApiClient();
  const { data: about, rateLimited } = await readOrRateLimited(
    dataOrNotFound(client.GET('/api/v1/administration/about')),
  );
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  return <AboutDetails about={about} />;
}
