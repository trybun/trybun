import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/organizations',
  notFound: vi.fn(),
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
    projects: [{ id: '0199a3f0-0000-7000-8000-000000000010', key: 'CP', name: 'Customer portal' }],
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

  it('says when every active project is added', () => {
    const html = render(<OrganizationProjects organization={organization()} />, (client) =>
      client.setQueryData(
        ['projects', 'list', 'active'],
        page([project('0199a3f0-0000-7000-8000-000000000010', 'Customer portal', 'CP')]),
      ),
    );

    expect(html).toContain('Every active project is already added.');
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
