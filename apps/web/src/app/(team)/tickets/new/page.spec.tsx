import { CATALOGUES } from '@trybun/i18n/catalogues';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const requireSession = vi.fn();
vi.mock('../../../../lib/auth/session.js', () => ({ requireSession }));
vi.mock('../../../../lib/env/env.js', () => ({ getEnv: () => ({ attachmentMaxSizeMb: 25 }) }));
const getNewTicketPage = vi.fn();
vi.mock('../../../../features/tickets/new-ticket-page.js', () => ({ getNewTicketPage }));
vi.mock('next-intl/server', () => ({
  getTranslations: () =>
    Promise.resolve(
      (key: keyof (typeof CATALOGUES)['en']['tickets']['form']) => CATALOGUES.en.tickets.form[key],
    ),
}));

const { default: NewTicketPage } = await import('./page.js');
const { TeamTicketForm } =
  await import('../../../../features/tickets/components/team-ticket-form.js');

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
const PROJECTS = [{ id: PROJECT_ID, name: 'ERP', allowedActions: ['read', 'create_ticket'] }];
const TEMPLATES = CATALOGUES.en.tickets.templates;

type Page = ReactElement<{ children: [ReactElement<{ children: string }>, ReactElement] }>;

async function render(searchParams: Record<string, string | string[] | undefined>) {
  return (await NewTicketPage({ searchParams: Promise.resolve(searchParams) })) as Page;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('NewTicketPage', () => {
  it('renders the form with the project of the address', async () => {
    getNewTicketPage.mockResolvedValue({ projects: PROJECTS, templates: TEMPLATES });

    const [heading, form] = (await render({ projectId: PROJECT_ID })).props.children;

    expect(requireSession).toHaveBeenCalledOnce();
    expect(heading.props.children).toBe('New ticket');
    expect(form).toMatchObject({
      type: TeamTicketForm,
      props: {
        projects: PROJECTS,
        requestedProjectId: PROJECT_ID,
        templates: TEMPLATES,
        attachmentMaxSizeMb: 25,
      },
    });
  });

  it.each([{ projectId: 'ERP' }, { projectId: [PROJECT_ID, PROJECT_ID] }, {}])(
    'ignores a project parameter that is no single project ID: %j',
    async (searchParams) => {
      getNewTicketPage.mockResolvedValue({ projects: PROJECTS, templates: TEMPLATES });

      const [, form] = (await render(searchParams)).props.children;

      expect(form.props).toMatchObject({ requestedProjectId: undefined });
    },
  );

  it('says so when no project allows creating a ticket (Q7)', async () => {
    getNewTicketPage.mockResolvedValue({ projects: [], templates: TEMPLATES });

    const [, empty] = (await render({})).props.children;

    expect(empty).toMatchObject({
      type: 'p',
      props: { children: 'You cannot create tickets in any project yet.' },
    });
  });
});
