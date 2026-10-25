import { GettingStartedChecklist } from '../../../features/administration/components/getting-started-checklist.js';
import { dataOrNotFound, getServerApiClient } from '../../../lib/api-client/server-api-client.js';
import { requireSession } from '../../../lib/auth/session.js';

/** The landing page of the Administrator panel: the getting-started checklist (§15.6). */
export default async function GettingStartedPage() {
  await requireSession('/admin');
  const client = await getServerApiClient();
  const page = await dataOrNotFound(client.GET('/api/v1/administration/getting-started'));
  return <GettingStartedChecklist items={page.items} />;
}
