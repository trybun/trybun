import 'server-only';
import type { UserKind } from '@trybun/contracts/users';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';
import { currentUserQueryOptions } from '../users/queries.js';

/**
 * The account kind of the signed-in reader, which decides the help pages they receive (§2.3).
 * Read from the account prefetched by the application shell; when the API cannot tell, the reader
 * receives only the pages for end users.
 */
export async function getHelpReaderKind(): Promise<UserKind> {
  const user = await getServerQueryClient()
    .fetchQuery(currentUserQueryOptions(await getServerApiClient()))
    .catch(() => undefined);
  return user?.kind ?? 'end_user';
}
