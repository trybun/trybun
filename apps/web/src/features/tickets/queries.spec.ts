import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createFakeApiClient } from '../../../test/dom/fake-api-client.js';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import {
  assigneeFilterOptionsQueryOptions,
  organizationFilterOptionsQueryOptions,
  projectFilterOptionsQueryOptions,
} from './queries.js';

type ListInit = { params: { query: { state?: string; cursor?: string; limit?: number } } };

/** Answers a list of `items` in pages of the requested limit, the cursor being the next offset. */
function paged<Item>(items: Item[]) {
  return (init: unknown) => {
    const { cursor, limit = 50 } = (init as ListInit).params.query;
    const offset = cursor === undefined ? 0 : Number(cursor);
    const end = Math.min(offset + limit, items.length);
    return {
      data: {
        items: items.slice(offset, end),
        nextCursor: end < items.length ? String(end) : null,
      },
    };
  };
}

/** Answers each state of a list with its own items. */
function pagedByState<Item>(byState: Record<string, Item[]>) {
  return (init: unknown) =>
    paged(byState[(init as ListInit).params.query.state ?? 'active']!)(init);
}

const index = (count: number) => Array.from({ length: count }, (_, number) => number + 1);
const uuid = (number: number) => `0199a3f0-0000-7000-8000-${String(number).padStart(12, '0')}`;

describe('ticket filter options (#272)', () => {
  it('offers every project beyond the first page, active and archived', async () => {
    const fake = createFakeApiClient();
    const project = (number: number) => ({
      id: uuid(number),
      key: `P${number}`,
      name: `Project ${number}`,
    });
    fake.on(
      'GET /api/v1/projects',
      pagedByState({ active: index(150).map(project), archived: [project(900)] }),
    );

    const options = await new QueryClient().fetchQuery(
      projectFilterOptionsQueryOptions(fake.client as unknown as ApiClient),
    );

    expect(options).toHaveLength(151);
    expect(options).toContainEqual({ id: uuid(150), label: 'P150 · Project 150' });
    expect(options).toContainEqual({ id: uuid(900), label: 'P900 · Project 900' });
    expect(
      fake.callsTo('GET /api/v1/projects').map(({ init }) => (init as ListInit).params.query),
    ).toEqual(
      expect.arrayContaining([
        { state: 'active', limit: 100 },
        { state: 'active', limit: 100, cursor: '100' },
        { state: 'archived', limit: 100 },
      ]),
    );
  });

  it('offers every organization beyond the first page, sorted by name and each once', async () => {
    const fake = createFakeApiClient();
    const organization = (number: number) => ({
      id: uuid(number),
      name: `Org ${String(number).padStart(3, '0')}`,
    });
    const active = index(150).map(organization);
    // A record that moved between two page reads is listed on both pages.
    fake.on(
      'GET /api/v1/organizations',
      pagedByState({
        active: [...active.slice(0, 100), active[99]!, ...active.slice(100)],
        archived: [],
      }),
    );

    const options = await new QueryClient().fetchQuery(
      organizationFilterOptionsQueryOptions(fake.client as unknown as ApiClient),
    );

    expect(options).toHaveLength(150);
    expect(options[0]).toEqual({ id: uuid(1), label: 'Org 001' });
    expect(options.at(-1)).toEqual({ id: uuid(150), label: 'Org 150' });
  });

  it('offers every member of the chosen projects beyond the first page, each person once', async () => {
    const fake = createFakeApiClient();
    const member = (number: number) => ({
      user: { id: uuid(number), displayName: number === 150 ? null : `Person ${number}` },
    });
    fake.on('GET /api/v1/projects/{projectId}/members', (init) => {
      const projectId = (init as { params: { path: { projectId: string } } }).params.path.projectId;
      return paged(projectId === uuid(1) ? index(150).map(member) : [member(1), member(200)])(init);
    });

    const options = await new QueryClient().fetchQuery(
      assigneeFilterOptionsQueryOptions(fake.client as unknown as ApiClient, [uuid(1), uuid(2)]),
    );

    expect(options).toHaveLength(151);
    expect(options).toContainEqual({ id: uuid(150), label: null });
    expect(options).toContainEqual({ id: uuid(200), label: 'Person 200' });
  });

  it('fails the options of a list whose later page fails, never offering a partial list', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/projects', (init) => {
      const { cursor } = (init as ListInit).params.query;
      return cursor === undefined
        ? { data: { items: [], nextCursor: 'next' } }
        : {
            status: 500,
            error: {
              type: 'about:blank',
              title: 'Error',
              status: 500,
              code: 'server.internal_error',
            },
          };
    });

    await expect(
      new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
        projectFilterOptionsQueryOptions(fake.client as unknown as ApiClient),
      ),
    ).rejects.toMatchObject({ status: 500 });
  });
});
