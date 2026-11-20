import 'server-only';
import { notFound } from 'next/navigation.js';
import { cache } from 'react';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { requireSession } from '../../lib/auth/session.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';
import { currentUserQueryOptions } from '../users/queries.js';

/**
 * The account of the Administrator for a list page of the Administrator panel (§7.3, §7.4), read
 * once per request for the page and its metadata (#404). An account without `open_administration`
 * sees the not-found page, as the API answers the reads of the panel with `404`. The read throws,
 * so a failure is not a missing permission: a `429` reaches the page, which shows it, and other
 * errors are thrown on (#356).
 */
export const getAdministrator = cache(async () => {
  await requireSession();
  const user = await getServerQueryClient().fetchQuery(
    currentUserQueryOptions(await getServerApiClient()),
  );
  if (!user.allowedActions.includes('open_administration')) {
    notFound();
  }
  return user;
});
