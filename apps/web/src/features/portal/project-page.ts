import 'server-only';
import { notFound } from 'next/navigation.js';
import { getServerApiClient } from '../../lib/api-client/server-api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';
import { getServerQueryClient } from '../../lib/query-client/server-query-client.js';
import { projectQueryOptions } from '../projects/queries.js';

/**
 * The project of a portal page, prefetched for the browser (§18.5): a project the end user cannot
 * read is answered `404` by the API, and the page is not found (§5.3).
 */
export async function getPortalProject(projectId: string) {
  const queryClient = getServerQueryClient();
  const options = projectQueryOptions(await getServerApiClient(), projectId);
  await queryClient.prefetchQuery(options);
  const error = queryClient.getQueryState(options.queryKey)?.error;
  if (error instanceof ApiError && error.status === 404) {
    notFound();
  }
  const project = queryClient.getQueryData(options.queryKey);
  if (project === undefined) {
    throw error ?? new Error('The project could not be read');
  }
  return project;
}
