import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../../lib/auth/session.js', () => ({ requireSession, getAccessToken: vi.fn() }));
const GET = vi.fn();
vi.mock('../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'projects') =>
    Promise.resolve(createTranslator({ locale: 'en', messages: CATALOGUES.en, namespace })),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));

const { default: ProjectsPage } = await import('./page.js');
const { default: ProjectSettingsPage } = await import('./[projectId]/settings/page.js');
const { LazyNewProjectDialog } =
  await import('../../../features/projects/components/lazy-new-project-dialog.js');

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
const project = {
  id: PROJECT_ID,
  name: 'Customer portal',
  key: 'CP',
  state: 'active',
  confirmResolution: false,
  version: 1,
  createdAt: '2026-10-27T09:00:00.000Z',
  updatedAt: '2026-10-27T09:00:00.000Z',
  role: null,
  allowedActions: ['read', 'read_members'],
};

function respond(path: string, status = 200) {
  const data =
    path === '/api/v1/users/me'
      ? { allowedActions: ['create_project'] }
      : path === '/api/v1/projects/{projectId}'
        ? project
        : { items: [], nextCursor: null };
  return Promise.resolve({
    data: status === 200 ? data : undefined,
    error: status === 200 ? undefined : { code: 'request.not_found', status },
    response: new Response(null, { status }),
  });
}

/** Whether an element tree contains an element of the given type. */
function contains(node: unknown, type: unknown): boolean {
  if (Array.isArray(node)) {
    return node.some((child) => contains(child, type));
  }
  if (node === null || typeof node !== 'object' || !('props' in node)) {
    return false;
  }
  const element = node as ReactElement<{ children?: unknown }>;
  return element.type === type || contains(element.props.children, type);
}

describe('ProjectsPage', () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    GET.mockImplementation((path: string) => respond(path));
  });

  it.each([
    [{}, 'active'],
    [{ state: 'archived' }, 'archived'],
    [{ state: 'other' }, 'active'],
  ])('prefetches the projects of %j', async (searchParams, state) => {
    const element = await ProjectsPage({ searchParams: Promise.resolve(searchParams) });

    expect(requireSession).toHaveBeenCalledWith();
    expect(GET).toHaveBeenCalledWith('/api/v1/projects', {
      params: { query: { state } },
      signal: expect.anything() as AbortSignal,
    });
    expect(contains(element, LazyNewProjectDialog)).toBe(true);
  });

  it('offers New project only with the global action create_project', async () => {
    GET.mockImplementation((path: string) =>
      path === '/api/v1/users/me'
        ? Promise.resolve({ data: { allowedActions: [] }, response: new Response() })
        : respond(path),
    );

    const element = await ProjectsPage({ searchParams: Promise.resolve({}) });

    expect(contains(element, LazyNewProjectDialog)).toBe(false);
  });
});

describe('ProjectSettingsPage', () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    GET.mockImplementation((path: string) => respond(path));
  });

  it('prefetches the project and its members', async () => {
    await ProjectSettingsPage({
      params: Promise.resolve({ projectId: PROJECT_ID }),
      searchParams: Promise.resolve({ tab: 'members' }),
    });

    expect(requireSession).toHaveBeenCalledWith();
    expect(GET).toHaveBeenCalledWith('/api/v1/projects/{projectId}/members', expect.anything());
  });

  it.each([
    ['an address that is not a project ID', 'not-a-uuid', 200],
    ['a project the person cannot see', PROJECT_ID, 404],
  ])('shows the not-found page for %s', async (_case, projectId, status) => {
    GET.mockImplementation(() => respond('', status));

    await expect(
      ProjectSettingsPage({
        params: Promise.resolve({ projectId }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
