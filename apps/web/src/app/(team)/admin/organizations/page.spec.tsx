import { CATALOGUES } from '@trybun/i18n/catalogues';
import { createFormatter, createTranslator } from 'next-intl';
import { prerender } from 'react-dom/static';
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
  getFormatter: () => Promise.resolve(createFormatter({ locale: 'en', timeZone: 'UTC' })),
  getNow: () => Promise.resolve(new Date('2026-11-18T12:00:00.000Z')),
}));
const REQUEST_PATH = '/admin/organizations';
vi.mock('next/headers.js', () => ({
  headers: () => Promise.resolve(new Headers({ 'x-trybun-request-path': REQUEST_PATH })),
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

/** The API's answer to more requests than the rate limit allows, with its `Retry-After` (§14.4). */
function rateLimited() {
  return Promise.resolve({
    error: {
      type: 'about:blank',
      title: 'Too Many Requests',
      status: 429,
      code: 'request.rate_limited',
    },
    response: new Response(null, { status: 429, headers: { 'Retry-After': '120' } }),
  });
}

/** The server HTML of a Server Component's element. */
async function html(element: ReactElement): Promise<string> {
  const { prelude } = await prerender(element);
  return new Response(prelude).text();
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
    notFound.mockClear();
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

  it('tells an Administrator over the rate limit when to try again, not that the page is gone (#356)', async () => {
    GET.mockImplementation((path: string) =>
      path === '/api/v1/users/me' ? rateLimited() : respond(path),
    );

    const element = await OrganizationsPage({ searchParams: Promise.resolve({}) });

    expect(notFound).not.toHaveBeenCalled();
    expect(await html(element)).toContain('Try again in 2 minutes.');
    expect(GET).not.toHaveBeenCalledWith('/api/v1/organizations', expect.anything());
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
    notFound.mockClear();
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

  it('tells a person over the rate limit when to try again, not that the organization is gone (#356)', async () => {
    GET.mockImplementation(() => rateLimited());

    const element = await OrganizationPage({
      params: Promise.resolve({ organizationId: ORGANIZATION_ID }),
    });

    expect(notFound).not.toHaveBeenCalled();
    expect(await html(element)).toContain('<h2 class="text-xl font-bold">Too many requests</h2>');
  });

  it('passes on an error of the API other than 404 and 429', async () => {
    GET.mockImplementation(() => respond('', { status: 500 }));

    await expect(
      OrganizationPage({ params: Promise.resolve({ organizationId: ORGANIZATION_ID }) }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 500 });
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
