import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import { ApiError } from '../../lib/errors/api-error.js';
import {
  organizationMembersQueryOptions,
  organizationQueryOptions,
  organizationsQueryOptions,
} from './queries.js';

const ORGANIZATION_ID = '0199a3f0-0000-7000-8000-000000000020';
const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
const page = { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'next' };

function client() {
  const GET = vi.fn(() => Promise.resolve({ data: page, response: new Response() }));
  return { client: { GET } as unknown as ApiClient, GET };
}

describe('organization queries', () => {
  it('reads the organizations page by page with the cursor of the previous page', async () => {
    const { client: api, GET } = client();
    const queryClient = new QueryClient();
    const options = organizationsQueryOptions(api, 'archived');

    await queryClient.fetchInfiniteQuery(options);
    await queryClient.fetchInfiniteQuery({ ...options, pages: 2 });

    expect(GET).toHaveBeenLastCalledWith('/api/v1/organizations', {
      params: { query: { state: 'archived', cursor: 'next' } },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('reads the organizations with access to a project under a key of their own', async () => {
    const { client: api, GET } = client();
    const options = organizationsQueryOptions(api, 'active', PROJECT_ID);

    await new QueryClient().fetchInfiniteQuery(options);

    expect(options.queryKey).toEqual(['organizations', 'list', 'active', PROJECT_ID]);
    expect(GET).toHaveBeenCalledWith('/api/v1/organizations', {
      params: { query: { state: 'active', projectId: PROJECT_ID } },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('reads the members page by page', async () => {
    const { client: api, GET } = client();

    await new QueryClient().fetchInfiniteQuery(
      organizationMembersQueryOptions(api, ORGANIZATION_ID),
    );

    expect(GET).toHaveBeenCalledWith('/api/v1/organizations/{organizationId}/members', {
      params: { path: { organizationId: ORGANIZATION_ID }, query: {} },
      signal: expect.anything() as AbortSignal,
    });
  });

  it.each([
    [new ApiError(404, 'request.not_found'), false],
    [new ApiError(503, 'server.unavailable'), true],
  ])('retries a detail that failed with %o: %s', (error, isRetried) => {
    const { client: api } = client();
    const { retry } = organizationQueryOptions(api, ORGANIZATION_ID);

    expect(typeof retry === 'function' && retry(0, error)).toBe(isRetried);
  });
});
