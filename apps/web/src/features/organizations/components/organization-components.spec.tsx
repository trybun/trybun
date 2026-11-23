import { QueryClient, QueryClientProvider, type QueryKey } from '@tanstack/react-query';
import type {
  Organization,
  OrganizationAction,
  OrganizationMemberPage,
} from '@trybun/contracts/organizations';
import type { Project } from '@trybun/contracts/projects';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { apiErrorOf } from '../../../lib/errors/api-error.js';
import {
  expectInOrder,
  FAILED_READ_MESSAGE as FAILED,
  seedFailedLaterPage,
} from '../../../../test/query-state.js';
import { ApiError } from '../../../lib/errors/api-error.js';

vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/organizations',
  useSearchParams: () => new URLSearchParams(),
}));

const { OrganizationList } = await import('./organization-list.js');
const { OrganizationStateTabs } = await import('./organization-state-tabs.js');
const { OrganizationDetail } = await import('./organization-detail.js');
const { OrganizationDomains } = await import('./organization-domains.js');
const { OrganizationProjects } = await import('./organization-projects.js');
const { OrganizationMembers } = await import('./organization-members.js');
const { OrganizationDangerZone } = await import('./organization-danger-zone.js');
const { NewOrganizationDialog } = await import('./new-organization-dialog.js');

const ORGANIZATION_ID = '0199a3f0-0000-7000-8000-000000000020';
const ACTIVE_ACTIONS: OrganizationAction[] = [
  'read',
  'update',
  'archive',
  'delete',
  'manage_projects',
  'manage_members',
];
const ARCHIVED_ACTIONS: OrganizationAction[] = ['read', 'unarchive', 'delete'];

function organization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: ORGANIZATION_ID,
    name: 'Acme',
    state: 'active',
    domains: ['acme.com', 'acme.pl'],
    memberCount: 2,
    version: 4,
    createdAt: '2026-10-27T09:00:00.000Z',
    updatedAt: '2026-10-27T09:00:00.000Z',
    allowedActions: ACTIVE_ACTIONS,
    projects: [
      {
        id: '0199a3f0-0000-7000-8000-000000000010',
        key: 'CP',
        name: 'Customer portal',
        state: 'active',
      },
    ],
    hasTickets: false,
    ...overrides,
  };
}

const members: OrganizationMemberPage = {
  items: [
    {
      user: {
        id: '0199a3f0-0000-7000-8000-000000000011',
        displayName: 'Ewa Klient',
        email: 'ewa@acme.com',
        state: 'active',
      },
      createdAt: '2026-10-27T09:00:00.000Z',
    },
    {
      user: {
        id: '0199a3f0-0000-7000-8000-000000000012',
        displayName: null,
        email: 'jan@acme.com',
        state: 'invited',
      },
      createdAt: '2026-10-28T09:00:00.000Z',
    },
  ],
  nextCursor: 'next',
};

function project(id: string, name: string, key: string): Project {
  return {
    id,
    name,
    key,
    state: 'active',
    confirmResolution: false,
    hasTickets: false,
    version: 1,
    createdAt: '2026-10-27T09:00:00.000Z',
    updatedAt: '2026-10-27T09:00:00.000Z',
    role: null,
    allowedActions: ['read'],
  };
}

const page = <T,>(items: T[]) => ({ pages: [{ items, nextCursor: null }], pageParams: [null] });

function seedDetail(client: QueryClient, value: Organization) {
  client.setQueryData(['organizations', 'detail', ORGANIZATION_ID], value);
  client.setQueryData(['organizations', 'members', ORGANIZATION_ID], {
    pages: [members],
    pageParams: [null],
  });
  client.setQueryData(
    ['projects', 'list', 'active'],
    page([
      project('0199a3f0-0000-7000-8000-000000000010', 'Customer portal', 'CP'),
      project('0199a3f0-0000-7000-8000-000000000013', 'ERP', 'ERP'),
    ]),
  );
}

/** A refusal of the rate limit with `Retry-After: 45` (§14.4). */
const REFUSED = new ApiError(429, 'request.rate_limited', [], 45);
/** The generic message of `request.rate_limited`, never shown alone for a refused read (#433). */
const GENERIC = 'Too many requests. Wait a moment and try again.';

/**
 * Seeds the state a refused first read leaves: no data and the status `error`. The client then
 * does not read again on mount (`retryOnMount`), which would show the loading state instead.
 */
function seedRefusedFirstRead(client: QueryClient, queryKey: QueryKey) {
  client.setDefaultOptions({ queries: { retryOnMount: false } });
  client
    .getQueryCache()
    .build(client, { queryKey })
    .setState({ status: 'error', error: REFUSED, fetchStatus: 'idle' });
}

function render(element: ReactElement, seed: (client: QueryClient) => void = () => {}) {
  const queryClient = new QueryClient();
  seed(queryClient);
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('OrganizationList', () => {
  it('lists each organization with its domains and member count, opening its detail', () => {
    const html = render(<OrganizationList state="active" />, (client) =>
      client.setQueryData(
        ['organizations', 'list', 'active'],
        page([
          organization(),
          organization({ id: 'other', name: 'Solo', domains: [], memberCount: 1 }),
        ]),
      ),
    );

    expect(html).toContain(`href="/admin/organizations/${ORGANIZATION_ID}"`);
    expect(html).toContain('acme.com, acme.pl');
    expect(html).toContain('2 members');
    expect(html).toContain('No e-mail domains');
    expect(html).toContain('1 member<');
  });

  it('says the organizations are loading while the browser reads them, never the empty state (#428)', () => {
    // No data: the prefetch of the server failed, or a first read in the browser.
    const html = render(<OrganizationList state="active" />);

    expect(html).toBe(
      '<p role="status" class="text-sm text-muted-foreground">Loading organizations…</p>',
    );
  });

  it('keeps the loaded organizations when a later page fails, with the error above Show more (#434)', () => {
    const html = render(<OrganizationList state="active" />, (client) =>
      seedFailedLaterPage(
        client,
        ['organizations', 'list', 'active'],
        [{ items: [organization()], nextCursor: 'next' }],
      ),
    );

    expectInOrder(html, 'acme.com, acme.pl', 'role="alert"', FAILED, 'Show more');
  });

  it('shows the wait and Reload page in place of the list when its read is refused (#433)', () => {
    const html = render(<OrganizationList state="active" />, (client) =>
      seedRefusedFirstRead(client, ['organizations', 'list', 'active']),
    );

    // `h3` under the `h2` of the page, inside the `h1` of the Administrator panel.
    expect(html).toContain('<h3 class="text-lg font-bold">Too many requests</h3>');
    expect(html).toContain('Try again in 45 seconds.');
    expect(html).toContain('<a href="/admin/organizations"');
    expect(html).not.toContain(GENERIC);
  });

  it('shows the wait above Show more, without Reload page, when a later page is refused (#433)', () => {
    const html = render(<OrganizationList state="active" />, (client) =>
      seedFailedLaterPage(
        client,
        ['organizations', 'list', 'active'],
        [{ items: [organization()], nextCursor: 'next' }],
        REFUSED,
      ),
    );

    // Reload page would drop the pages already loaded; Show more tries the page again (#434).
    expectInOrder(html, 'acme.com, acme.pl', 'Too many requests', 'Show more');
    expect(html).toContain('<h3 class="text-lg font-bold">Too many requests</h3>');
    expect(html).not.toContain('Reload page');
    expect(html).not.toContain(GENERIC);
  });

  it.each([
    ['active', 'Organizations are optional.'],
    ['archived', 'No archived organizations.'],
  ] as const)('explains an empty list of %s organizations', (state, text) => {
    const html = render(<OrganizationList state={state} />, (client) =>
      client.setQueryData(['organizations', 'list', state], page([])),
    );

    expect(html).toContain(text);
  });
});

describe('OrganizationStateTabs', () => {
  it('shows the Active and Archived tabs with the list of the current one', () => {
    const html = render(<OrganizationStateTabs state="archived" />, (client) =>
      client.setQueryData(
        ['organizations', 'list', 'archived'],
        page([organization({ state: 'archived' })]),
      ),
    );

    expect(html).toContain('aria-label="Organization state"');
    expect(html).toContain('Active');
    expect(html).toContain('Acme');
  });
});

describe('OrganizationDetail', () => {
  it('shows the sections with their tour targets and every action of an active organization', () => {
    const html = render(<OrganizationDetail organizationId={ORGANIZATION_ID} />, (client) =>
      seedDetail(client, organization()),
    );

    expect(html).toContain('data-tour="organization-detail-domains"');
    expect(html).toContain('data-tour="organization-detail-projects"');
    expect(html).toContain('data-tour="organization-detail-add-member"');
    expect(html).toContain('href="/admin/organizations"');
    expect(html).toContain('Save');
    expect(html).toContain('Archive organization');
    expect(html).toContain('Delete organization');
    expect(html).not.toContain('This organization is archived');
    // The detail of one record keeps the readable width (§2.9).
    expect(html).toMatch(/^<div class="[^"]*\bmax-w-3xl\b/);
  });

  it('shows an archived organization read-only with the banner and Unarchive', () => {
    const html = render(<OrganizationDetail organizationId={ORGANIZATION_ID} />, (client) =>
      seedDetail(client, organization({ state: 'archived', allowedActions: ARCHIVED_ACTIONS })),
    );

    expect(html).toContain('This organization is archived');
    expect(html).toContain('Unarchive organization');
    expect(html).toContain('readOnly=""');
    expect(html).toContain('acme.com');
    expect(html).toContain('Ewa Klient');
    expect(html).toContain('data-tour="organization-detail-domains"');
    // The optional tour step about adding members has no target.
    expect(html).not.toContain('data-tour="organization-detail-add-member"');
    expect(html).not.toContain('Remove');
    expect(html).not.toContain('Add domain');
    expect(html).not.toContain('Archive organization');
    expect(html).toContain('Delete organization');
  });

  it('renders nothing before the organization is loaded', () => {
    expect(render(<OrganizationDetail organizationId={ORGANIZATION_ID} />)).toBe('');
  });
});

describe('OrganizationDomains', () => {
  it('offers removing each domain and adding one with update', () => {
    const html = render(<OrganizationDomains organization={organization()} />);

    expect(html).toContain('aria-label="Remove acme.com"');
    expect(html).toContain('Add domain');
  });

  it('says when there are no domains', () => {
    const html = render(
      <OrganizationDomains
        organization={organization({ domains: [], allowedActions: ['read'] })}
      />,
    );

    expect(html).toContain('No e-mail domains.');
    expect(html).not.toContain('Add domain');
  });
});

describe('OrganizationProjects', () => {
  it('lists the projects with Remove and offers the other active projects', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) =>
      seedDetail(client, organization()),
    );

    expect(html).toContain('Customer portal');
    expect(html).toContain('aria-label="Remove Customer portal"');
    expect(html).toContain('Choose a project');
    expect(html).toContain('Add project');
  });

  it('says the projects to choose are loading in place of the picker (#428)', () => {
    const html = render(<OrganizationProjects organization={organization()} />);

    expect(html).toContain(
      '<p role="status" class="text-sm text-muted-foreground">Loading projects…</p>',
    );
    // Never the picker without projects, which looks like "no projects to add".
    expect(html).not.toContain('Choose a project');
    expect(html).not.toContain('Every active project is already added.');
    expect(html).toContain('aria-label="Remove Customer portal"');
  });

  it('shows only the error of a failed first read of the projects to choose, never the picker (#428)', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) => {
      // The read failed already; the section shows that answer instead of reading again.
      client.setDefaultOptions({ queries: { retryOnMount: false } });
      client
        .getQueryCache()
        .build(client, { queryKey: ['projects', 'list', 'active'] })
        .setState({ status: 'error', error: apiErrorOf(500, undefined), fetchStatus: 'idle' });
    });

    expect(html).toContain(`<p role="alert" class="text-sm text-destructive">${FAILED}</p>`);
    expect(html).not.toContain('Choose a project');
    expect(html).not.toContain('role="status"');
  });

  it('says when every active project is added', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) =>
      client.setQueryData(
        ['projects', 'list', 'active'],
        page([project('0199a3f0-0000-7000-8000-000000000010', 'Customer portal', 'CP')]),
      ),
    );

    expect(html).toContain('Every active project is already added.');
  });

  it('marks an archived project and offers no Remove for it', () => {
    const value = organization({
      projects: [
        {
          id: '0199a3f0-0000-7000-8000-000000000014',
          key: 'OLD',
          name: 'Legacy',
          state: 'archived',
        },
      ],
    });

    const html = render(<OrganizationProjects organization={value} />, (client) =>
      seedDetail(client, value),
    );

    expect(html).toContain('Legacy');
    expect(html).toContain('Archived');
    expect(html).not.toContain('aria-label="Remove Legacy"');
  });

  it('shows the error of a failed later page of the projects to choose above Show more (#434)', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) =>
      seedFailedLaterPage(
        client,
        ['projects', 'list', 'active'],
        [
          {
            items: [project('0199a3f0-0000-7000-8000-000000000013', 'ERP', 'ERP')],
            nextCursor: 'next',
          },
        ],
      ),
    );

    expectInOrder(html, 'Choose a project', 'role="alert"', FAILED, 'Show more');
  });

  it('shows the wait without Reload page above Show more when a later page of the projects to choose is refused (#433)', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) =>
      seedFailedLaterPage(
        client,
        ['projects', 'list', 'active'],
        [
          {
            items: [project('0199a3f0-0000-7000-8000-000000000013', 'ERP', 'ERP')],
            nextCursor: 'next',
          },
        ],
        REFUSED,
      ),
    );

    // **Show more** tries the page again and keeps the projects loaded (#434).
    expectInOrder(
      html,
      'Choose a project',
      'Too many requests',
      'Try again in 45 seconds.',
      'Show more',
    );
    expect(html).toContain('<h4 class="text-base font-bold">Too many requests</h4>');
    expect(html).not.toContain('Reload page');
    expect(html).not.toContain(GENERIC);
  });

  it('shows the wait and Reload page when the read of the projects to choose is refused (#433)', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) =>
      seedRefusedFirstRead(client, ['projects', 'list', 'active']),
    );

    // `h4` under the `h3` of the section.
    expect(html).toContain('<h4 class="text-base font-bold">Too many requests</h4>');
    expect(html).toContain('Try again in 45 seconds.');
    expect(html).toContain('Reload page');
    expect(html).not.toContain(GENERIC);
  });

  it('says when the organization may access no projects', () => {
    const html = render(
      <OrganizationProjects
        organization={organization({ projects: [], allowedActions: ['read'] })}
      />,
    );

    expect(html).toContain('The organization may access no projects yet.');
    expect(html).not.toContain('Add project');
  });
});

describe('OrganizationMembers', () => {
  function renderMembers(value: Organization) {
    return render(<OrganizationMembers organization={value} />, (client) =>
      seedDetail(client, value),
    );
  }

  it('says the members are loading while the browser reads them, never the empty state (#428)', () => {
    const html = render(<OrganizationMembers organization={organization()} />);

    expect(html).toContain(
      '<p role="status" class="text-sm text-muted-foreground">Loading members…</p>',
    );
    expect(html).not.toContain('The organization has no members yet.');
    // The form to add a member stays usable.
    expect(html).toContain('E-mail address');
  });

  it('lists the members with e-mail address, account state and joined date', () => {
    const html = renderMembers(organization());

    expect(html).toContain('Ewa Klient');
    expect(html).toContain('ewa@acme.com');
    expect(html).toContain('Joined Oct 27, 2026');
    // An account that is not active shows its state; one without a name shows its address.
    expect(html).toContain('Invited');
    expect(html).toContain('aria-label="Remove jan@acme.com"');
    expect(html).toContain('E-mail address');
    expect(html).toContain('Show more');
  });

  it('keeps the loaded members when a later page fails, with the error above Show more (#434)', () => {
    const html = render(<OrganizationMembers organization={organization()} />, (client) => {
      seedDetail(client, organization());
      seedFailedLaterPage(client, ['organizations', 'members', ORGANIZATION_ID], [members]);
    });

    expectInOrder(html, 'ewa@acme.com', 'jan@acme.com', 'role="alert"', FAILED, 'Show more');
    // Not in place of the rows or their empty state.
    expect(html.match(/role="alert"/g)).toHaveLength(1);
  });

  it('shows the wait without Reload page above Show more when a later page is refused (#433)', () => {
    const html = render(<OrganizationMembers organization={organization()} />, (client) => {
      seedDetail(client, organization());
      seedFailedLaterPage(
        client,
        ['organizations', 'members', ORGANIZATION_ID],
        [members],
        REFUSED,
      );
    });

    expectInOrder(
      html,
      'jan@acme.com',
      'Too many requests',
      'Try again in 45 seconds.',
      'Show more',
    );
    expect(html).toContain('<h4 class="text-base font-bold">Too many requests</h4>');
    expect(html).not.toContain('Reload page');
    expect(html).not.toContain(GENERIC);
  });

  it('shows the wait and Reload page in place of the members when their read is refused (#433)', () => {
    const html = render(<OrganizationMembers organization={organization()} />, (client) => {
      client.setQueryData(['organizations', 'detail', ORGANIZATION_ID], organization());
      seedRefusedFirstRead(client, ['organizations', 'members', ORGANIZATION_ID]);
    });

    // `h4` under the `h3` of the section.
    expect(html).toContain('<h4 class="text-base font-bold">Too many requests</h4>');
    expect(html).toContain('Try again in 45 seconds.');
    expect(html).toContain('<a href="/admin/organizations"');
    expect(html).not.toContain(GENERIC);
  });

  it('shows the members read-only without manage_members', () => {
    const html = renderMembers(organization({ allowedActions: ARCHIVED_ACTIONS }));

    expect(html).toContain('Ewa Klient');
    expect(html).not.toContain('Remove');
    expect(html).not.toContain('Add member');
  });
});

describe('OrganizationDangerZone', () => {
  it('offers archiving and deletion of an active organization', () => {
    const html = render(<OrganizationDangerZone organization={organization()} />);

    expect(html).toContain('Archive organization');
    expect(html).toContain('Delete organization');
  });

  it('disables the deletion of an organization with tickets, with the reason', () => {
    const html = render(
      <OrganizationDangerZone organization={organization({ hasTickets: true })} />,
    );

    expect(html).toContain(
      'Organizations with tickets cannot be deleted. Archive the organization instead.',
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Delete organization<\/button>/);
  });

  it('renders nothing without an action of it', () => {
    const html = render(
      <OrganizationDangerZone organization={organization({ allowedActions: ['read'] })} />,
    );

    expect(html).toBe('');
  });
});

describe('NewOrganizationDialog', () => {
  it('renders its button, the dialog opening on request', () => {
    const html = render(<NewOrganizationDialog />);

    expect(html).toContain('New organization');
    expect(html).not.toContain('Create organization');
  });
});
