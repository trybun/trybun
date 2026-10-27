import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Project, ProjectAction, ProjectMemberPage } from '@trybun/contracts/projects';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ComponentProps, ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/link', () => ({ default: (props: ComponentProps<'a'>) => <a {...props} /> }));
vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/projects',
}));

const { ProjectList } = await import('./project-list.js');
const { ProjectSettings } = await import('./project-settings.js');
const { ProjectGeneralForm } = await import('./project-general-form.js');
const { ProjectDangerZone } = await import('./project-danger-zone.js');
const { ProjectMembers } = await import('./project-members.js');
const { ProjectStateTabs } = await import('./project-state-tabs.js');
const { NewProjectDialog } = await import('./new-project-dialog.js');

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: PROJECT_ID,
    name: 'Customer portal',
    key: 'CP',
    state: 'active',
    confirmResolution: false,
    version: 3,
    createdAt: '2026-10-27T09:00:00.000Z',
    updatedAt: '2026-10-27T09:00:00.000Z',
    role: 'project_manager',
    allowedActions: ['read', 'update_settings', 'read_members', 'manage_members'],
    ...overrides,
  };
}

const ADMIN_ACTIONS: ProjectAction[] = [
  'read',
  'update',
  'update_settings',
  'archive',
  'unarchive',
  'delete',
  'read_members',
  'manage_members',
];

const members: ProjectMemberPage = {
  items: [
    {
      user: {
        id: '0199a3f0-0000-7000-8000-000000000011',
        displayName: 'Anna Nowak',
        githubLogin: 'anowak',
      },
      role: 'project_manager',
      createdAt: '2026-10-27T09:00:00.000Z',
    },
  ],
  nextCursor: null,
};

function render(element: ReactElement, seed: (client: QueryClient) => void = () => {}) {
  const queryClient = new QueryClient();
  seed(queryClient);
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

/** The server HTML with the lazily loaded components resolved (§18.7). */
async function prerenderToString(element: ReactElement, seed: (client: QueryClient) => void) {
  const queryClient = new QueryClient();
  seed(queryClient);
  const { prelude } = await prerender(
    <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return new Response(prelude).text();
}

const page = (items: Project[]) => ({ pages: [{ items, nextCursor: null }], pageParams: [null] });

describe('ProjectList', () => {
  it('lists each project with its key and the person’s role, opening its settings', () => {
    const html = render(<ProjectList state="active" />, (client) =>
      client.setQueryData(
        ['projects', 'list', 'active'],
        page([project(), project({ id: 'other', name: 'ERP', key: 'ERP', role: null })]),
      ),
    );

    expect(html).toContain(`href="/projects/${PROJECT_ID}/settings"`);
    expect(html).toContain('Customer portal');
    expect(html).toContain('Project manager');
    expect(html).toContain('Administrator');
  });

  it.each([
    ['active', 'No projects yet.'],
    ['archived', 'No archived projects.'],
  ] as const)('says when there are no %s projects', (state, text) => {
    const html = render(<ProjectList state={state} />, (client) =>
      client.setQueryData(['projects', 'list', state], page([])),
    );

    expect(html).toContain(text);
  });
});

describe('ProjectSettings', () => {
  function renderSettings(value: Project) {
    return render(<ProjectSettings projectId={PROJECT_ID} tab="general" />, (client) => {
      client.setQueryData(['projects', 'detail', PROJECT_ID], value);
      client.setQueryData(['projects', 'members', PROJECT_ID], {
        pages: [members],
        pageParams: [null],
      });
    });
  }

  it('shows the Danger zone only with an action of it', () => {
    expect(renderSettings(project())).not.toContain('Danger zone');
    expect(renderSettings(project({ allowedActions: ADMIN_ACTIONS }))).toContain('Danger zone');
  });

  it('shows the banner of an archived project', () => {
    const html = renderSettings(
      project({ state: 'archived', allowedActions: ['read', 'read_members'] }),
    );

    expect(html).toContain('This project is archived and read-only.');
  });
});

describe('ProjectGeneralForm', () => {
  it('shows the name and the key read-only to a Project manager, with the switch to save', () => {
    const html = render(<ProjectGeneralForm project={project()} />);

    expect(html.match(/readOnly=""/g)).toHaveLength(2);
    expect(html).toContain('Only the Administrator changes the name and the key.');
    expect(html).toContain('Save changes');
  });

  it('offers nothing to save to a Developer', () => {
    const html = render(
      <ProjectGeneralForm project={project({ role: 'developer', allowedActions: ['read'] })} />,
    );

    expect(html).not.toContain('Save changes');
  });
});

describe('ProjectDangerZone', () => {
  it('offers archiving and deletion of an active project', () => {
    const html = render(<ProjectDangerZone project={project({ allowedActions: ADMIN_ACTIONS })} />);

    expect(html).toContain('Archive project');
    expect(html).toContain('Delete project');
    expect(html).not.toContain('Unarchive project');
  });

  it('asks to unarchive an archived project before deleting it', () => {
    const html = render(
      <ProjectDangerZone
        project={project({
          state: 'archived',
          allowedActions: ['read', 'read_members', 'unarchive'],
        })}
      />,
    );

    expect(html).toContain('Unarchive project');
    expect(html).toContain('Unarchive the project before you delete it.');
    expect(html).not.toContain('>Archive project<');
  });
});

describe('ProjectMembers', () => {
  function renderMembers(value: Project) {
    return render(<ProjectMembers project={value} />, (client) =>
      client.setQueryData(['projects', 'members', PROJECT_ID], {
        pages: [members],
        pageParams: [null],
      }),
    );
  }

  it('lets a Project manager change roles and remove members', () => {
    const html = renderMembers(project());

    expect(html).toContain('Anna Nowak');
    expect(html).toContain('@anowak');
    expect(html).toContain('aria-label="Role of Anna Nowak"');
    expect(html).toContain('aria-label="Remove Anna Nowak"');
  });

  it('renders the Add member button on the server, before its dialog code loads', async () => {
    const html = await prerenderToString(<ProjectMembers project={project()} />, (client) =>
      client.setQueryData(['projects', 'members', PROJECT_ID], {
        pages: [members],
        pageParams: [null],
      }),
    );

    expect(html).toContain('Add member');
  });

  it('shows a Developer the roles only', () => {
    const html = renderMembers(
      project({ role: 'developer', allowedActions: ['read', 'read_members'] }),
    );

    expect(html).toContain('Project manager');
    expect(html).not.toContain('Remove');
    expect(html).not.toContain('Add member');
  });
});

describe('ProjectStateTabs', () => {
  it('shows the Active and Archived tabs with the list of the current one', () => {
    const html = render(<ProjectStateTabs state="archived" />, (client) =>
      client.setQueryData(['projects', 'list', 'archived'], page([project({ state: 'archived' })])),
    );

    expect(html).toContain('Active');
    expect(html).toContain('Archived');
    expect(html).toContain('Customer portal');
  });
});

describe('NewProjectDialog', () => {
  it('renders its button, the dialog opening on request', () => {
    const html = render(<NewProjectDialog />);

    expect(html).toContain('New project');
    expect(html).not.toContain('Create project');
  });
});
