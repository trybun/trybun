import { AboutDetails } from '../../../../features/administration/components/about-details.js';
import {
  dataOrNotFound,
  getServerApiClient,
} from '../../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../../lib/auth/session.js';

/** The "About" page of the Administrator panel (§15.4). */
export default async function AboutPage() {
  await requireSession();
  const client = await getServerApiClient();
  const about = await dataOrNotFound(client.GET('/api/v1/administration/about'));
  return <AboutDetails about={about} />;
}
