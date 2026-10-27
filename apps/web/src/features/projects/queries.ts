import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import type { ProjectRole, ProjectState } from '@trybun/contracts/projects';
import { type ApiClient, dataOf } from '../../lib/api-client/api-client.js';

/** The number of member candidates the picker shows for a search (§7.4). */
const MEMBER_CANDIDATES_LIMIT = 20;

/** The projects of one state the person can see, page by page (§18.4). */
export function projectsQueryOptions(client: ApiClient, state: ProjectState) {
  return infiniteQueryOptions({
    queryKey: ['projects', 'list', state],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/projects', {
          params: { query: { state, ...(pageParam === null ? {} : { cursor: pageParam }) } },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/** A project with the actions the person may perform on it (§18.3). */
export function projectQueryOptions(client: ApiClient, projectId: string) {
  return queryOptions({
    queryKey: ['projects', 'detail', projectId],
    queryFn: ({ signal }) =>
      dataOf(
        client.GET('/api/v1/projects/{projectId}', {
          params: { path: { projectId } },
          signal,
        }),
      ),
  });
}

/** The members of a project, page by page (§7.4). */
export function projectMembersQueryOptions(client: ApiClient, projectId: string) {
  return infiniteQueryOptions({
    queryKey: ['projects', 'members', projectId],
    queryFn: ({ pageParam, signal }) =>
      dataOf(
        client.GET('/api/v1/projects/{projectId}/members', {
          params: {
            path: { projectId },
            query: pageParam === null ? {} : { cursor: pageParam },
          },
          signal,
        }),
      ),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
  });
}

/**
 * Whether the project has more than one member of a role, for the warning before the last
 * Project manager is removed or demoted (§7.4): two members are enough to know.
 */
export function projectRoleCountQueryOptions(
  client: ApiClient,
  projectId: string,
  role: ProjectRole,
) {
  return queryOptions({
    queryKey: ['projects', 'members', projectId, 'count', role],
    queryFn: async ({ signal }) => {
      const page = await dataOf(
        client.GET('/api/v1/projects/{projectId}/members', {
          params: { path: { projectId }, query: { role, limit: 2 } },
          signal,
        }),
      );
      return page.items.length;
    },
  });
}

/** The active team accounts that are not members, for the member picker (§7.4). */
export function memberCandidatesQueryOptions(client: ApiClient, projectId: string, search: string) {
  return queryOptions({
    queryKey: ['projects', 'member-candidates', projectId, search],
    queryFn: ({ signal }) =>
      dataOf(
        client.GET('/api/v1/projects/{projectId}/member-candidates', {
          params: {
            path: { projectId },
            query: { limit: MEMBER_CANDIDATES_LIMIT, ...(search === '' ? {} : { query: search }) },
          },
          signal,
        }),
      ),
  });
}
