import { GettingStartedChecklist } from '../../../features/administration/components/getting-started-checklist.js';
import { RateLimitedNotice } from '../../../features/app-shell/components/rate-limited-notice.js';
import {
  dataOrNotFound,
  getServerApiClient,
  readOrRateLimited,
} from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';

/**
 * The landing page of the Administrator panel: the getting-started checklist (§15.6). A person over
 * the rate limit is told so (§14.4).
 */
export default async function GettingStartedPage() {
  await requireSession();
  const client = await getServerApiClient();
  const { data: page, rateLimited } = await readOrRateLimited(
    dataOrNotFound(client.GET('/api/v1/administration/getting-started')),
  );
  if (rateLimited !== undefined) {
    return <RateLimitedNotice error={rateLimited} headingLevel={2} />;
  }
  return <GettingStartedChecklist items={page.items} />;
}
