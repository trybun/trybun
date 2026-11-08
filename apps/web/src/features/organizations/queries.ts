import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { OrganizationState } from '@trybun/contracts/organizations';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';

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
    queryFn: ({ pageParam, signal }) =>
      dataOf(
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
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/**
 * An organization with its projects and the actions the Administrator may perform on it (§18.3).
 * A `4xx` is an answer, not a failure to retry: a deleted organization shows the not-found page.
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
    retry: (failureCount, error) =>
      !(error instanceof ApiError && error.status < 500) && failureCount < 3,
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
