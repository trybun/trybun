// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { ProjectAction } from '@trybun/contracts/projects';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { TABLET_MEDIA_QUERY } from '@trybun/ui/hooks/use-media-query';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation.js', () => ({ useRouter: () => ({ push }) }));
const toastAdd = vi.hoisted(() => vi.fn());
vi.mock('@trybun/ui/components/toast', () => ({ toast: { add: toastAdd } }));
// The pickers adapt to the width (jsdom has no `matchMedia`): a tablet.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: query === TABLET_MEDIA_QUERY,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));
// jsdom has no `execCommand`: the editor replaces its placeholders without an undo entry.
Object.defineProperty(document, 'execCommand', { value: () => false });

const { TeamTicketForm } = await import('./team-ticket-form.js');

const fake = createFakeApiClient();
api.current = fake.client;

const TEMPLATES = CATALOGUES.en.tickets.templates;
const ME = { id: '0199a3f0-0000-7000-8000-000000000031', displayName: 'Anna' };
const JAN = { id: '0199a3f0-0000-7000-8000-000000000032', displayName: 'Jan' };
const CREATE: ProjectAction[] = ['read', 'create_ticket'];
const ERP = { id: '0199a3f0-0000-7000-8000-000000000010', name: 'ERP', allowedActions: CREATE };
const CP = { id: '0199a3f0-0000-7000-8000-000000000011', name: 'Customer portal' };

type FormProps = Parameters<typeof TeamTicketForm>[0];

function renderForm(props: Partial<FormProps> = {}) {
  return renderInApp(
    <TeamTicketForm projects={[ERP]} templates={TEMPLATES} attachmentMaxSizeMb={25} {...props} />,
  );
}

/** The description editor, loaded lazily. */
function description() {
  return screen.findByRole('textbox', { name: 'Description' }, { timeout: 5_000 });
}

/** The chosen item of a select, without the text of its icon. */
function selected(name: string) {
  return screen.getByRole('combobox', { name }).textContent.replace(/▼$/, '');
}

beforeEach(() => {
  fake.on('GET /api/v1/users/me', {
    data: { ...ME, email: 'anna@example.com', kind: 'team', language: 'en', timeZone: null },
  });
  fake.on('GET /api/v1/projects/{projectId}/members', {
    data: {
      items: [ME, JAN].map((user) => ({
        user: { ...user, githubLogin: null },
        role: 'developer',
        createdAt: '2026-11-01T09:00:00.000Z',
      })),
      nextCursor: null,
    },
  });
});

afterEach(() => {
  cleanup();
  fake.reset();
  push.mockClear();
  toastAdd.mockClear();
});

describe('TeamTicketForm', () => {
  it('starts with the only project, type task, its template and priority normal (§3.3)', async () => {
    renderForm();

    expect(await description()).toHaveProperty('value', TEMPLATES.task);
    expect(selected('Project')).toBe('ERP');
    expect(screen.getByRole('radio', { name: 'Task' }).getAttribute('aria-checked')).toBe('true');
    expect(selected('Priority')).toBe('Normal');
  });

  it.each([
    ['the project it was opened from', CP.id, 'Customer portal'],
    ['no project for an unknown one', '0199a3f0-0000-7000-8000-0000000000ff', 'Choose a project'],
    ['no project without one (Q6)', undefined, 'Choose a project'],
  ])('preselects %s among several projects', (_, requestedProjectId, expected) => {
    renderForm({ projects: [ERP, { ...CP, allowedActions: CREATE }], requestedProjectId });

    expect(selected('Project')).toBe(expected);
  });

  it('asks for a project and a title without sending anything', async () => {
    const events = userEvent.setup();
    renderForm({ projects: [ERP, { ...CP, allowedActions: CREATE }] });

    await events.click(screen.getByRole('button', { name: 'Create ticket' }));

    expect(await screen.findByText('Choose a project.')).toBeDefined();
    expect(screen.getByText('Enter a title.')).toBeDefined();
    expect(fake.callsTo('POST /api/v1/tickets')).toHaveLength(0);
  });

  it('replaces an unchanged template and the default priority when the type changes (§3.4)', async () => {
    const events = userEvent.setup();
    renderForm();
    const editor = await description();

    await events.click(screen.getByRole('radio', { name: 'Question' }));

    expect(editor).toHaveProperty('value', TEMPLATES.question);
    expect(selected('Priority')).toBe('Low');
    await events.click(screen.getByRole('radio', { name: 'Bug' }));
    expect(editor).toHaveProperty('value', TEMPLATES.bug);
    expect(selected('Priority')).toBe('Normal');
  });

  it('never overwrites an edited description or a chosen priority (§3.4)', async () => {
    const events = userEvent.setup();
    renderForm();
    const editor = await description();
    await events.type(editor, '\nExport the invoices');
    await events.click(screen.getByRole('combobox', { name: 'Priority' }));
    await events.click(await screen.findByRole('option', { name: 'High' }));

    await events.click(screen.getByRole('radio', { name: 'Question' }));

    expect(editor).toHaveProperty('value', `${TEMPLATES.task}\nExport the invoices`);
    expect(selected('Priority')).toBe('High');
  });

  it('replaces the template again once it is restored exactly (Q3)', async () => {
    const events = userEvent.setup();
    renderForm();
    const editor = await description();
    await events.type(editor, 'x');
    await events.type(editor, '{Backspace}');

    await events.click(screen.getByRole('radio', { name: 'Feature' }));

    expect(editor).toHaveProperty('value', TEMPLATES.feature);
  });

  it('keeps the templates it inserted when the page brings another language (Q4)', async () => {
    const events = userEvent.setup();
    const { client, rerender } = renderForm();
    const editor = await description();

    rerender(
      <NextIntlClientProvider locale="en" messages={CATALOGUES.en} timeZone="UTC">
        <QueryClientProvider client={client}>
          <TeamTicketForm
            projects={[ERP]}
            templates={CATALOGUES.pl.tickets.templates}
            attachmentMaxSizeMb={25}
          />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
    await events.click(screen.getByRole('radio', { name: 'Bug' }));

    expect(editor).toHaveProperty('value', TEMPLATES.bug);
  });

  it('inserts the templates it is given, e.g. Polish ones', async () => {
    renderInApp(
      <TeamTicketForm
        projects={[ERP]}
        templates={CATALOGUES.pl.tickets.templates}
        attachmentMaxSizeMb={25}
      />,
      { locale: 'pl' },
    );

    expect(await screen.findByRole('textbox', { name: 'Opis' }, { timeout: 5_000 })).toHaveProperty(
      'value',
      CATALOGUES.pl.tickets.templates.task,
    );
  });

  describe('assignee by the actions of the project (Q15)', () => {
    it('offers the picker with assign_tickets and sends the chosen person', async () => {
      const events = userEvent.setup();
      fake.on('POST /api/v1/tickets', { status: 201, data: { identifier: 'ERP-12' } });
      renderForm({ projects: [{ ...ERP, allowedActions: [...CREATE, 'assign_tickets'] }] });

      await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Export the invoices');
      await events.click(await screen.findByRole('combobox', { name: 'Assignee' }));
      const list = await screen.findByRole('listbox', { name: 'People' });
      await events.click(await within(list).findByRole('option', { name: 'Jan' }));
      await events.click(screen.getByRole('button', { name: 'Create ticket' }));

      await waitFor(() =>
        expect(fake.callsTo('POST /api/v1/tickets')[0]?.init).toMatchObject({
          body: { assigneeId: JAN.id },
        }),
      );
      expect(screen.queryByRole('checkbox', { name: 'Assign to me' })).toBeNull();
    });

    it('offers only the Assign to me checkbox with assign_tickets_self', async () => {
      const events = userEvent.setup();
      fake.on('POST /api/v1/tickets', { status: 201, data: { identifier: 'ERP-12' } });
      renderForm({ projects: [{ ...ERP, allowedActions: [...CREATE, 'assign_tickets_self'] }] });

      await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Export the invoices');
      await events.click(await screen.findByRole('checkbox', { name: 'Assign to me' }));
      await events.click(screen.getByRole('button', { name: 'Create ticket' }));

      await waitFor(() =>
        expect(fake.callsTo('POST /api/v1/tickets')[0]?.init).toMatchObject({
          body: { assigneeId: ME.id },
        }),
      );
      expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
    });

    it('offers no assignee control without either action', async () => {
      renderForm();
      await description();

      expect(screen.queryByRole('combobox', { name: 'Assignee' })).toBeNull();
      expect(screen.queryByRole('checkbox', { name: 'Assign to me' })).toBeNull();
    });
  });

  it('creates the ticket with the chosen fields and opens it with a toast', async () => {
    const events = userEvent.setup();
    fake.on('POST /api/v1/tickets', { status: 201, data: { identifier: 'ERP-12' } });
    renderForm();

    await events.click(screen.getByRole('radio', { name: 'Question' }));
    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Where are the invoices?');
    await events.click(screen.getByRole('button', { name: 'Create ticket' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/tickets/ERP-12'));
    // The typed text is saved: no question, and the entry for Back is taken back first.
    expect(screen.queryByText('Discard your changes?')).toBeNull();
    expect(window.history.state).toBeNull();
    expect(fake.callsTo('POST /api/v1/tickets')[0]?.init).toMatchObject({
      body: {
        projectId: ERP.id,
        type: 'question',
        title: 'Where are the invoices?',
        description: TEMPLATES.question,
        priority: 'low',
        assigneeId: null,
      },
    });
    expect(toastAdd).toHaveBeenCalledWith({ title: 'Ticket ERP-12 created', type: 'success' });
  });

  it('creates one ticket on a double press', async () => {
    const events = userEvent.setup();
    let answer: () => void = () => undefined;
    fake.client.POST.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          answer = () =>
            resolve({
              data: { identifier: 'ERP-12' },
              response: new Response(null, { status: 201 }),
            });
        }),
    );
    renderForm();

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Export the invoices');
    const submit = screen.getByRole('button', { name: 'Create ticket' });
    await events.click(submit);
    await events.click(submit);

    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(true));
    expect(fake.client.POST).toHaveBeenCalledOnce();
    answer();
    await waitFor(() => expect(push).toHaveBeenCalledOnce());
  });

  it('shows the field errors of a 422 at their fields', async () => {
    const events = userEvent.setup();
    fake.on('POST /api/v1/tickets', {
      status: 422,
      error: {
        type: 'about:blank',
        title: 'Unprocessable Content',
        status: 422,
        code: 'request.validation_failed',
        errors: [{ pointer: '/title', code: 'string.too_long', detail: 'Too long' }],
      },
    });
    renderForm();

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Export the invoices');
    await events.click(screen.getByRole('button', { name: 'Create ticket' }));

    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: 'Title' }).getAttribute('aria-invalid')).toBe(
        'true',
      ),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('asks before a link leaves a typed title, and not while the form is untouched', async () => {
    const events = userEvent.setup();
    renderForm();
    await description();

    await events.click(screen.getByRole('radio', { name: 'Bug' }));
    await events.click(screen.getByRole('link', { name: 'Cancel' }));
    expect(screen.queryByText('Discard your changes?')).toBeNull();

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Export the invoices');
    await events.click(screen.getByRole('link', { name: 'Cancel' }));

    expect(await screen.findByText('Discard your changes?', {}, { timeout: 5_000 })).toBeDefined();
    await events.click(screen.getByRole('button', { name: 'Discard' }));
    expect(push).toHaveBeenCalledWith('/');
  });

  it('asks when Back is pressed after typing a title, and keeps the text on Keep editing', async () => {
    const events = userEvent.setup();
    window.history.pushState(null, '', '/tickets');
    window.history.pushState(null, '', '/tickets/new');
    renderForm();
    await description();

    await events.type(screen.getByRole('textbox', { name: 'Title' }), 'Export the invoices');
    window.history.back();

    expect(await screen.findByText('Discard your changes?', {}, { timeout: 5_000 })).toBeDefined();
    expect(window.location.pathname).toBe('/tickets/new');
    await events.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveProperty(
      'value',
      'Export the invoices',
    );

    window.history.back();
    await events.click(await screen.findByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(window.location.pathname).toBe('/tickets'));
    expect(push).not.toHaveBeenCalled();
  });
});
