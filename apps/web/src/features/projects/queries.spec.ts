import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import {
  memberCandidatesQueryOptions,
  projectMembersQueryOptions,
  projectRoleCountQueryOptions,
  projectsQueryOptions,
} from './queries.js';

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
const page = { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'next' };

function client() {
  const GET = vi.fn(() => Promise.resolve({ data: page, response: new Response() }));
  return { client: { GET } as unknown as ApiClient, GET };
}

describe('project queries', () => {
  it('reads the projects page by page with the cursor of the previous page', async () => {
    const { client: api, GET } = client();
    const queryClient = new QueryClient();
    const options = projectsQueryOptions(api, 'archived');

    await queryClient.fetchInfiniteQuery(options);
    await queryClient.fetchInfiniteQuery({ ...options, pages: 2 });

    expect(GET).toHaveBeenLastCalledWith('/api/v1/projects', {
      params: { query: { state: 'archived', cursor: 'next' } },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('reads the members page by page', async () => {
    const { client: api, GET } = client();

    await new QueryClient().fetchInfiniteQuery(projectMembersQueryOptions(api, PROJECT_ID));

    expect(GET).toHaveBeenCalledWith('/api/v1/projects/{projectId}/members', {
      params: { path: { projectId: PROJECT_ID }, query: {} },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('counts at most two members of a role', async () => {
    const { client: api } = client();

    const count = await new QueryClient().fetchQuery(
      projectRoleCountQueryOptions(api, PROJECT_ID, 'project_manager'),
    );

    expect(count).toBe(2);
  });

  it.each([
    ['', { limit: 20 }],
    ['anna', { limit: 20, query: 'anna' }],
  ])('searches the member candidates for %j', async (search, query) => {
    const { client: api, GET } = client();

    await new QueryClient().fetchQuery(memberCandidatesQueryOptions(api, PROJECT_ID, search));

    expect(GET).toHaveBeenCalledWith('/api/v1/projects/{projectId}/member-candidates', {
      params: { path: { projectId: PROJECT_ID }, query },
      signal: expect.anything() as AbortSignal,
    });
  });
});
