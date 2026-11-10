import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { createFakeApiClient } from '../../../test/dom/fake-api-client.js';
import type { ApiClient } from '../../lib/api-client/api-client.js';
import {
  assigneeFilterNamesQueryOptions,
  assigneeFilterSearchQueryOptions,
  organizationFilterNamesQueryOptions,
  organizationFilterSearchQueryOptions,
  projectFilterNamesQueryOptions,
  projectFilterSearchQueryOptions,
} from './queries.js';

type ListQuery = { state?: string; query?: string; id?: string[]; limit?: number };
type ListInit = { params: { query: ListQuery } };

const queryOf = (init: unknown) => (init as ListInit).params.query;
const uuid = (number: number) => `0199a3f0-0000-7000-8000-${String(number).padStart(12, '0')}`;
const project = (number: number) => ({
  id: uuid(number),
  key: `P${number}`,
  name: `Project ${number}`,
});

describe('ticket filter search (#279)', () => {
  it('searches the projects of both states, the active ones first, each once', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/projects', (init) =>
      queryOf(init).state === 'archived'
        ? { data: { items: [project(9), project(2)], nextCursor: null } }
        : { data: { items: [project(2), project(1)], nextCursor: 'next' } },
    );

    const page = await new QueryClient().fetchQuery(
      projectFilterSearchQueryOptions(fake.client as unknown as ApiClient, '  p1 '),
    );

    expect(page.records).toEqual([
      { id: uuid(2), label: 'P2 · Project 2', short: 'P2' },
      { id: uuid(1), label: 'P1 · Project 1', short: 'P1' },
      { id: uuid(9), label: 'P9 · Project 9', short: 'P9' },
    ]);
    // The active list has another page: typing finds more.
    expect(page.hasMore).toBe(true);
    expect(fake.callsTo('GET /api/v1/projects').map(({ init }) => queryOf(init))).toEqual([
      { state: 'active', limit: 50, query: 'p1' },
      { state: 'archived', limit: 50, query: 'p1' },
    ]);
  });

  it('sends no query for a blank search', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/organizations', {
      data: { items: [{ id: uuid(3), name: 'Acme' }], nextCursor: null },
    });

    const page = await new QueryClient().fetchQuery(
      organizationFilterSearchQueryOptions(fake.client as unknown as ApiClient, '   '),
    );

    expect(page).toEqual({ records: [{ id: uuid(3), label: 'Acme' }], hasMore: false });
    expect(fake.callsTo('GET /api/v1/organizations').map(({ init }) => queryOf(init))).toEqual([
      { state: 'active', limit: 50 },
      { state: 'archived', limit: 50 },
    ]);
  });

  it('searches the people of every chosen project in one request', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/project-members', {
      data: {
        items: [
          { id: uuid(5), displayName: 'Anna', githubLogin: 'anna' },
          { id: uuid(6), displayName: null, githubLogin: 'bob' },
          { id: uuid(7), displayName: null, githubLogin: null },
        ],
        nextCursor: null,
      },
    });

    const page = await new QueryClient().fetchQuery(
      assigneeFilterSearchQueryOptions(
        fake.client as unknown as ApiClient,
        [uuid(2), uuid(1)],
        'a',
      ),
    );

    expect(page.records).toEqual([
      { id: uuid(5), label: 'Anna' },
      { id: uuid(6), label: '@bob' },
      { id: uuid(7), label: null },
    ]);
    expect(fake.callsTo('GET /api/v1/project-members')).toHaveLength(1);
    expect(queryOf(fake.callsTo('GET /api/v1/project-members')[0]?.init)).toEqual({
      projectId: [uuid(2), uuid(1)],
      limit: 50,
      query: 'a',
    });
  });

  it('keys a search by its text, so an older answer never replaces a newer one', () => {
    const client = createFakeApiClient().client as unknown as ApiClient;
    expect(projectFilterSearchQueryOptions(client, 'qm').queryKey).not.toEqual(
      projectFilterSearchQueryOptions(client, 'qm1').queryKey,
    );
    expect(assigneeFilterSearchQueryOptions(client, [uuid(1), uuid(2)], '').queryKey).toEqual(
      assigneeFilterSearchQueryOptions(client, [uuid(2), uuid(1)], ' ').queryKey,
    );
  });

  it('offers nobody before a project is chosen', () => {
    const client = createFakeApiClient().client as unknown as ApiClient;
    expect(assigneeFilterSearchQueryOptions(client, [], '').enabled).toBe(false);
  });

  it('never retries a refused search (429)', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/projects', {
      status: 429,
      error: { type: 'about:blank', title: 'Too many', status: 429, code: 'request.rate_limited' },
    });
    const options = projectFilterSearchQueryOptions(fake.client as unknown as ApiClient, 'x');

    await expect(new QueryClient().fetchQuery(options)).rejects.toMatchObject({ status: 429 });
    expect(fake.callsTo('GET /api/v1/projects')).toHaveLength(2);
  });
});

describe('ticket filter names (#279)', () => {
  it('names chosen projects by ID in both states', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/projects', (init) => ({
      data: {
        items: queryOf(init).state === 'archived' ? [project(150)] : [project(1)],
        nextCursor: null,
      },
    }));

    const records = await new QueryClient().fetchQuery(
      projectFilterNamesQueryOptions(fake.client as unknown as ApiClient, [uuid(150), uuid(1)]),
    );

    expect(records.map(({ id }) => id)).toEqual([uuid(1), uuid(150)]);
    expect(fake.callsTo('GET /api/v1/projects').map(({ init }) => queryOf(init))).toEqual([
      { state: 'active', id: [uuid(150), uuid(1)], limit: 50 },
      { state: 'archived', id: [uuid(150), uuid(1)], limit: 50 },
    ]);
  });

  it('names chosen organizations and people by ID', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/organizations', {
      data: { items: [{ id: uuid(3), name: 'Acme' }], nextCursor: null },
    });
    fake.on('GET /api/v1/project-members', {
      data: { items: [{ id: uuid(5), displayName: 'Anna', githubLogin: null }], nextCursor: null },
    });
    const client = fake.client as unknown as ApiClient;

    await expect(
      new QueryClient().fetchQuery(organizationFilterNamesQueryOptions(client, [uuid(3)])),
    ).resolves.toEqual([{ id: uuid(3), label: 'Acme' }]);
    await expect(
      new QueryClient().fetchQuery(assigneeFilterNamesQueryOptions(client, [uuid(5), uuid(8)])),
    ).resolves.toEqual([{ id: uuid(5), label: 'Anna' }]);
    expect(queryOf(fake.callsTo('GET /api/v1/project-members')[0]?.init)).toEqual({
      userId: [uuid(5), uuid(8)],
      limit: 50,
    });
  });

  it('looks nothing up without chosen IDs', () => {
    const client = createFakeApiClient().client as unknown as ApiClient;
    expect(projectFilterNamesQueryOptions(client, []).enabled).toBe(false);
    expect(organizationFilterNamesQueryOptions(client, []).enabled).toBe(false);
    expect(assigneeFilterNamesQueryOptions(client, []).enabled).toBe(false);
  });

  it('fails the names when one state fails, never naming a value "Unknown" for an error', async () => {
    const fake = createFakeApiClient();
    fake.on('GET /api/v1/projects', (init) =>
      queryOf(init).state === 'archived'
        ? {
            status: 500,
            error: {
              type: 'about:blank',
              title: 'Error',
              status: 500,
              code: 'server.internal_error',
            },
          }
        : { data: { items: [], nextCursor: null } },
    );

    // A server error is tried again by the factory's rule; here once is enough.
    const options = projectFilterNamesQueryOptions(fake.client as unknown as ApiClient, [uuid(1)]);
    await expect(new QueryClient().fetchQuery({ ...options, retry: false })).rejects.toMatchObject({
      status: 500,
    });
  });
});
