import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createTranslator } from 'next-intl';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const requireSession = vi.fn();
vi.mock('../../../../lib/auth/session.js', () => ({ requireSession, getAccessToken: vi.fn() }));
const GET = vi.fn();
vi.mock('../../../../lib/api-client/server-api-client.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getServerApiClient: () => Promise.resolve({ GET }),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'organizations') =>
    Promise.resolve(createTranslator({ locale: 'en', messages: CATALOGUES.en, namespace })),
}));
const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation.js', () => ({ notFound }));

const { default: OrganizationsPage } = await import('./page.js');
const { default: OrganizationPage } = await import('./[organizationId]/page.js');
const { LazyNewOrganizationDialog } =
  await import('../../../../features/organizations/components/lazy-new-organization-dialog.js');

const ORGANIZATION_ID = '0199a3f0-0000-7000-8000-000000000020';
const ADMIN_ACTIONS = ['open_administration', 'create_project', 'create_organization'];

function organization(allowedActions: string[]) {
  return {
    id: ORGANIZATION_ID,
    name: 'Acme',
    state: 'active',
    domains: [],
    memberCount: 0,
    version: 1,
    createdAt: '2026-10-27T09:00:00.000Z',
    updatedAt: '2026-10-27T09:00:00.000Z',
    allowedActions,
    projects: [],
  };
}

function respond(
  path: string,
  {
    status = 200,
    userActions = ADMIN_ACTIONS,
    organizationActions = ['read', 'manage_projects'],
  } = {},
) {
  const data =
    path === '/api/v1/users/me'
      ? { allowedActions: userActions }
      : path === '/api/v1/organizations/{organizationId}'
        ? organization(organizationActions)
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

describe('OrganizationsPage', () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    GET.mockImplementation((path: string) => respond(path));
  });

  it.each([
    [{}, 'active'],
    [{ state: 'archived' }, 'archived'],
    [{ state: 'other' }, 'active'],
  ])('prefetches the organizations of %j', async (searchParams, state) => {
    const element = await OrganizationsPage({ searchParams: Promise.resolve(searchParams) });

    expect(requireSession).toHaveBeenCalledWith();
    expect(GET).toHaveBeenCalledWith('/api/v1/organizations', {
      params: { query: { state } },
      signal: expect.anything() as AbortSignal,
    });
    expect(contains(element, LazyNewOrganizationDialog)).toBe(true);
  });

  it('offers New organization only with the global action create_organization', async () => {
    GET.mockImplementation((path: string) =>
      respond(path, { userActions: ['open_administration'] }),
    );

    const element = await OrganizationsPage({ searchParams: Promise.resolve({}) });

    expect(contains(element, LazyNewOrganizationDialog)).toBe(false);
  });

  it('shows the not-found page to a person who is not the Administrator', async () => {
    GET.mockImplementation((path: string) => respond(path, { userActions: ['create_project'] }));

    await expect(OrganizationsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(GET).not.toHaveBeenCalledWith('/api/v1/organizations', expect.anything());
  });
});

describe('OrganizationPage', () => {
  beforeEach(() => {
    requireSession.mockResolvedValue({ expires: '2026-11-03T09:15:00.000Z' });
    GET.mockImplementation((path: string) => respond(path));
  });

  it('prefetches the members and, with manage_projects, the active projects to add', async () => {
    await OrganizationPage({ params: Promise.resolve({ organizationId: ORGANIZATION_ID }) });

    expect(requireSession).toHaveBeenCalledWith();
    expect(GET).toHaveBeenCalledWith(
      '/api/v1/organizations/{organizationId}/members',
      expect.anything(),
    );
    expect(GET).toHaveBeenCalledWith('/api/v1/projects', {
      params: { query: { state: 'active' } },
      signal: expect.anything() as AbortSignal,
    });
  });

  it('reads no projects of an archived organization', async () => {
    GET.mockImplementation((path: string) =>
      respond(path, { organizationActions: ['read', 'unarchive', 'delete'] }),
    );

    await OrganizationPage({ params: Promise.resolve({ organizationId: ORGANIZATION_ID }) });

    expect(GET).not.toHaveBeenCalledWith('/api/v1/projects', expect.anything());
  });

  it.each([
    ['an address that is not an organization ID', 'not-a-uuid', 200],
    ['an organization the person cannot see', ORGANIZATION_ID, 404],
  ])('shows the not-found page for %s', async (_case, organizationId, status) => {
    GET.mockImplementation(() => respond('', { status }));

    await expect(OrganizationPage({ params: Promise.resolve({ organizationId }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});
