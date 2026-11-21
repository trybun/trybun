import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { isOrganizationSummary, type OrganizationState } from '@trybun/contracts/organizations';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/**
 * The organizations of one state, page by page (§7.3); with `projectId` only those that may access
 * the project (the project settings).
 */
export function organizationsQueryOptions(
  client: ApiClient,
  state: OrganizationState,
  projectId?: string,
) {
  return infiniteQueryOptions({
    queryKey: ['organizations', 'list', state, ...(projectId === undefined ? [] : [projectId])],
    // The Administrator's pages hold summaries; other team members read names only (S1-13 Q6).
    queryFn: async ({ pageParam, signal }) => {
      const page = await dataOf(
        client.GET('/api/v1/organizations', {
          params: {
            query: {
              state,
              ...(projectId === undefined ? {} : { projectId }),
              ...(pageParam === null ? {} : { cursor: pageParam }),
            },
          },
          signal,
        }),
      );
      return { ...page, items: page.items.filter(isOrganizationSummary) };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/**
 * An organization with its projects and the actions the Administrator may perform on it (§18.3).
 * Like every refusal, a `4xx` is not retried (`retryUnlessRefused`): a deleted organization shows
 * the not-found page at once.
 */
export function organizationQueryOptions(client: ApiClient, organizationId: string) {
  return queryOptions({
    queryKey: ['organizations', 'detail', organizationId],
    queryFn: ({ signal }) =>
      dataOf(
        client.GET('/api/v1/organizations/{organizationId}', {
          params: { path: { organizationId } },
          signal,
        }),
      ),
  });
}

/** The members of an organization, page by page (§7.3). */
export function organizationMembersQueryOptions(client: ApiClient, organizationId: string) {
  return infiniteQueryOptions({
    queryKey: ['organizations', 'members', organizationId],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/organizations/{organizationId}/members', {
          params: {
            path: { organizationId },
            query: pageParam === null ? {} : { cursor: pageParam },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}
