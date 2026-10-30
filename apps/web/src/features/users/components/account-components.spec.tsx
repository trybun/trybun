// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { User, UserAction } from '@trybun/contracts/users';
import { toast } from '@trybun/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
const replace = vi.hoisted(() => vi.fn());
const changeLanguage = vi.hoisted(() => vi.fn());
const changeTimeZone = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => '/admin/accounts',
}));
vi.mock('../../../lib/i18n/change-language.js', () => ({ changeLanguage }));
vi.mock('../../../lib/i18n/change-time-zone.js', () => ({ changeTimeZone }));

const { AccountActions } = await import('./account-actions.js');
const { AccountList } = await import('./account-list.js');
const { AccountSettingsForm } = await import('./account-settings-form.js');

const fake = createFakeApiClient();
api.current = fake.client;

const USER_ID = '0199a3f0-0000-7000-8000-000000000001';

function user(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    displayName: 'Anna Kowalska',
    email: 'anna@acme.com',
    kind: 'end_user',
    state: 'active',
    isAdmin: false,
    githubLogin: null,
    createdAt: '2026-10-27T09:00:00.000Z',
    allowedActions: [],
    ...overrides,
  };
}

let toasts: MockInstance<typeof toast.add>;
beforeEach(() => {
  fake.reset();
  replace.mockClear();
  changeLanguage.mockClear();
  changeTimeZone.mockClear();
  toasts = vi.spyOn(toast, 'add');
});
afterEach(() => {
  cleanup();
  toasts.mockRestore();
});

describe('AccountActions', () => {
  it('renders nothing for an account without allowed actions', () => {
    const { container } = renderInApp(<AccountActions user={user()} name="Anna" />);

    expect(container.innerHTML).toBe('');
  });

  async function open(actions: UserAction[]) {
    const events = userEvent.setup();
    renderInApp(<AccountActions user={user({ allowedActions: actions })} name="Anna" />);
    await events.click(screen.getByRole('button', { name: /Anna/ }));
    return events;
  }

  it('offers only the allowed actions', async () => {
    await open(['reactivate', 'grant_admin']);

    expect(await screen.findByRole('menuitem', { name: 'Reactivate' })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: 'Grant Administrator role' })).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).toBeNull();
  });

  it('reactivates at once, without a confirmation', async () => {
    fake.on('POST /api/v1/users/{userId}/reactivation', { status: 200, data: {} });
    const events = await open(['reactivate']);

    await events.click(await screen.findByRole('menuitem', { name: 'Reactivate' }));

    await waitFor(() =>
      expect(fake.callsTo('POST /api/v1/users/{userId}/reactivation')).toHaveLength(1),
    );
    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' })),
    );
  });

  it('grants the Administrator role at once', async () => {
    fake.on('PUT /api/v1/users/{userId}/administrator-role', { status: 200, data: {} });
    const events = await open(['grant_admin']);

    await events.click(await screen.findByRole('menuitem', { name: 'Grant Administrator role' }));

    await waitFor(() =>
      expect(fake.callsTo('PUT /api/v1/users/{userId}/administrator-role')).toHaveLength(1),
    );
  });

  it('deactivates only after the confirmation with its effects', async () => {
    fake.on('POST /api/v1/users/{userId}/deactivation', { status: 200, data: {} });
    const events = await open(['deactivate']);

    await events.click(await screen.findByRole('menuitem', { name: 'Deactivate' }));
    const dialog = await screen.findByRole('dialog');
    expect(fake.callsTo('POST /api/v1/users/{userId}/deactivation')).toHaveLength(0);
    await events.click(
      within(dialog)
        .getAllByRole('button')
        .find((b) => /Deactivate/.test(b.textContent))!,
    );

    await waitFor(() =>
      expect(fake.callsTo('POST /api/v1/users/{userId}/deactivation')).toHaveLength(1),
    );
  });

  it('cancels a confirmation without a request', async () => {
    const events = await open(['revoke_admin']);

    await events.click(await screen.findByRole('menuitem', { name: 'Revoke Administrator role' }));
    const dialog = await screen.findByRole('dialog');
    await events.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fake.calls).toHaveLength(0);
  });

  it('shows the refusal of the API, e.g. the last Administrator', async () => {
    fake.on('DELETE /api/v1/users/{userId}/administrator-role', {
      status: 409,
      error: {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        code: 'user.last_administrator',
      },
    });
    const events = await open(['revoke_admin']);

    await events.click(await screen.findByRole('menuitem', { name: 'Revoke Administrator role' }));
    const dialog = await screen.findByRole('dialog');
    await events.click(
      within(dialog)
        .getAllByRole('button')
        .find((b) => /Revoke/.test(b.textContent))!,
    );

    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    );
  });
});

describe('AccountList', () => {
  const page = (items: User[], nextCursor: string | null = null) => ({
    data: { items, nextCursor },
  });

  it('lists the accounts with their state and role badges', async () => {
    fake.on(
      'GET /api/v1/users',
      page([
        user({ isAdmin: true, kind: 'team' }),
        user({
          id: '0199a3f0-0000-7000-8000-000000000002',
          displayName: null,
          email: 'b@acme.com',
          state: 'deactivated',
        }),
      ]),
    );
    renderInApp(<AccountList />);

    expect((await screen.findAllByText('anna@acme.com')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Administrator').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Deactivated').length).toBeGreaterThan(0);
  });

  it('says so when no account matches', async () => {
    fake.on('GET /api/v1/users', page([]));
    renderInApp(<AccountList />);

    expect(await screen.findByText('No accounts match these filters.')).toBeTruthy();
  });

  it('shows the error of a failed request', async () => {
    fake.on('GET /api/v1/users', { status: 500, error: {} });
    renderInApp(<AccountList />);

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('loads the next page and searches by the typed text', async () => {
    fake.on('GET /api/v1/users', (init) => {
      const query = (init as { params: { query: { cursor?: string } } }).params.query;
      return query.cursor === undefined
        ? page([user()], 'next').valueOf()
        : page([
            user({
              id: '0199a3f0-0000-7000-8000-000000000003',
              displayName: 'Second',
              email: 's@acme.com',
            }),
          ]);
    });
    const events = userEvent.setup();
    renderInApp(<AccountList kind="end_user" state="active" />);

    await events.click(await screen.findByRole('button', { name: 'Load more' }));
    expect((await screen.findAllByText('s@acme.com')).length).toBeGreaterThan(0);

    await events.type(screen.getByRole('searchbox'), 'ann');
    await waitFor(() =>
      expect(
        fake
          .callsTo('GET /api/v1/users')
          .some((call) => JSON.stringify(call.init).includes('"query":"ann"')),
      ).toBe(true),
    );
  });

  it('changes the filters through the URL', async () => {
    fake.on('GET /api/v1/users', page([user()]));
    const events = userEvent.setup();
    renderInApp(<AccountList />);

    await events.click(screen.getByRole('combobox', { name: 'Kind' }));
    await events.click(await screen.findByRole('option', { name: 'Team' }));

    expect(replace).toHaveBeenCalledWith('/admin/accounts?kind=team');
  });
});

describe('AccountSettingsForm', () => {
  const me = (overrides = {}) => ({
    id: USER_ID,
    language: 'en',
    timeZone: null,
    ...overrides,
  });

  it('saves a new language and the device time zone, then switches both', async () => {
    fake.on('GET /api/v1/users/me', { data: me() });
    fake.on('PATCH /api/v1/users/me', (init) => ({ data: me((init as { body: object }).body) }));
    const events = userEvent.setup();
    renderInApp(<AccountSettingsForm systemTimeZone="Europe/Warsaw" />);

    await events.click(screen.getByRole('combobox', { name: 'Language' }));
    await events.click(await screen.findByRole('option', { name: 'Polski' }));
    await events.click(await screen.findByRole('button', { name: /Use this device/ }));
    await events.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fake.callsTo('PATCH /api/v1/users/me')).toHaveLength(1));
    const body = (fake.callsTo('PATCH /api/v1/users/me')[0]!.init as { body: { language: string } })
      .body;
    expect(body.language).toBe('pl');
    await waitFor(() => expect(changeLanguage).toHaveBeenCalledWith('pl'));
    expect(changeTimeZone).toHaveBeenCalled();
    expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ type: 'success' }));
  });

  it('picks a time zone from the searchable list', async () => {
    fake.on('GET /api/v1/users/me', { data: me() });
    fake.on('PATCH /api/v1/users/me', { data: me({ timeZone: 'Europe/Paris' }) });
    const events = userEvent.setup();
    renderInApp(<AccountSettingsForm systemTimeZone="UTC" />);

    await events.type(screen.getByRole('combobox', { name: 'Time zone' }), 'Europe/Paris');
    await events.click(await screen.findByRole('option', { name: 'Europe/Paris' }));
    await events.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(changeTimeZone).toHaveBeenCalledWith('Europe/Paris'));
    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('shows a refusal of the API at the field it names', async () => {
    fake.on('GET /api/v1/users/me', { data: me() });
    fake.on('PATCH /api/v1/users/me', {
      status: 422,
      error: {
        type: 'about:blank',
        title: 'Validation',
        status: 422,
        code: 'validation.failed',
        errors: [{ field: 'timeZone', code: 'validation.invalid' }],
      },
    });
    const events = userEvent.setup();
    renderInApp(<AccountSettingsForm systemTimeZone="UTC" />);

    await events.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(fake.callsTo('PATCH /api/v1/users/me')).toHaveLength(1));
    expect(changeLanguage).not.toHaveBeenCalled();
    expect(toasts).not.toHaveBeenCalled();
  });

  it('shows an error without a field above the button', async () => {
    fake.on('GET /api/v1/users/me', { data: me() });
    fake.on('PATCH /api/v1/users/me', { status: 500, error: {} });
    const events = userEvent.setup();
    renderInApp(<AccountSettingsForm systemTimeZone="UTC" />);

    await events.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });
});
