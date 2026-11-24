// @vitest-environment jsdom
import { useQuery } from '@tanstack/react-query';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { User } from '@trybun/contracts/users';
import { toast } from '@trybun/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createFakeApiClient, laterPagesFail } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';
import { rateLimitedResult } from '../../../../test/factories/rate-limited.factory.js';

const api = vi.hoisted((): { current: unknown } => ({ current: undefined }));
const signInToContinue = vi.hoisted(() => vi.fn());
const signOutInPlace = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/api-client/browser-api-client.js', () => ({
  get browserApiClient() {
    return api.current;
  },
}));
vi.mock('../acceptance-sign-in.js', () => ({ signInToContinue }));
vi.mock('../../sessions/keycloak-sign-in.js', () => ({ signOutInPlace }));
vi.mock('next/navigation.js', () => ({
  usePathname: () => '/invitations',
  useSearchParams: () => new URLSearchParams(),
}));

const { InviteDialog } = await import('./invite-dialog.js');
const { AddMemberDialog } = await import('../../projects/components/add-member-dialog.js');
const { ContinueAcceptance } = await import('./continue-acceptance.js');
const { InvitationOffer } = await import('./invitation-offer.js');
const { AccountInvitations } = await import('./account-invitations.js');
const { PendingInvitationList } = await import('./pending-invitation-list.js');
const { ProjectInvitations } = await import('../../projects/components/project-invitations.js');
const { PasswordAcceptanceForm } = await import('./password-acceptance-form.js');
const { writePendingAcceptance, readPendingAcceptance } = await import('../acceptance-state.js');

const fake = createFakeApiClient();
api.current = fake.client;

const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';
const INVITATION_ID = '0199a3f0-0000-7000-8000-000000000050';
const LINK = 'https://trybun.example.com/invitations#token=abc';

const invitation = (overrides = {}) => ({
  id: INVITATION_ID,
  user: { id: '0199a3f0-0000-7000-8000-000000000001', email: 'new@acme.com', displayName: null },
  kind: 'team',
  target: { type: 'administrator' },
  invitedBy: { displayName: 'Marek Manager' },
  expiresAt: '2026-11-05T09:30:00.000Z',
  createdAt: '2026-10-29T09:30:00.000Z',
  allowedActions: ['resend', 'revoke'],
  ...overrides,
});

let toasts: MockInstance<typeof toast.add>;
beforeEach(() => {
  fake.reset();
  signInToContinue.mockReset();
  signOutInPlace.mockReset().mockResolvedValue(undefined);
  window.sessionStorage.clear();
  toasts = vi.spyOn(toast, 'add');
});
afterEach(() => {
  cleanup();
  toasts.mockRestore();
  window.history.replaceState(null, '', '/');
});

describe('InviteDialog', () => {
  async function inviteAdministrator(events: ReturnType<typeof userEvent.setup>) {
    renderInApp(<InviteDialog kind="team" />);
    await events.click(screen.getByRole('button', { name: 'Invite' }));
    // Pasted, not typed: key by key re-renders the form per character, which takes most of each
    // test and passed the 5 s timeout under the load of `pnpm test:coverage` (#319).
    await events.click(await screen.findByRole('textbox', { name: 'E-mail address' }));
    await events.paste('new@acme.com');
    await events.click(screen.getByRole('radio', { name: 'The Administrator role' }));
  }

  it('previews the invitation, sends it and shows the link once', async () => {
    fake.on('POST /api/v1/invitation-previews', {
      data: { outcome: 'invite', organization: null },
    });
    fake.on('POST /api/v1/invitations', {
      status: 201,
      data: { outcome: 'invited', invitation: invitation(), link: LINK },
    });
    const events = userEvent.setup();
    await inviteAdministrator(events);

    expect(await screen.findByText('This person gets an invitation link.')).toBeTruthy();
    await events.click(screen.getByRole('button', { name: 'Invite' }));

    expect(await screen.findByDisplayValue(LINK)).toBeTruthy();
    expect(fake.callsTo('POST /api/v1/invitations')[0]!.init).toMatchObject({
      body: { email: 'new@acme.com', target: { type: 'administrator' } },
    });
  });

  it('says that an existing account gets the access at once', async () => {
    fake.on('POST /api/v1/invitation-previews', { data: { outcome: 'grant', organization: null } });
    fake.on('POST /api/v1/invitations', {
      data: { outcome: 'access_granted', user: { id: PROJECT_ID, displayName: 'Anna' } },
    });
    const events = userEvent.setup();
    await inviteAdministrator(events);

    await events.click(await screen.findByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Access granted to Anna' }),
      ),
    );
  });

  it('shows a refusal of the API under the form', async () => {
    fake.on('POST /api/v1/invitation-previews', {
      data: { outcome: 'invite', organization: null },
    });
    fake.on('POST /api/v1/invitations', { status: 500, error: {} });
    const events = userEvent.setup();
    await inviteAdministrator(events);

    await events.click(await screen.findByRole('button', { name: 'Invite' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('picks an organization of the list for an end user', async () => {
    fake.on('POST /api/v1/invitation-previews', {
      data: { outcome: 'invite', organization: null },
    });
    fake.on('GET /api/v1/organizations', {
      data: {
        items: [{ id: PROJECT_ID, name: 'Acme', state: 'active' }],
        nextCursor: null,
      },
    });
    const events = userEvent.setup();
    renderInApp(<InviteDialog email="anna@acme.com" kind="end_user" />);

    await events.click(screen.getByRole('button', { name: 'Invite anna@acme.com' }));
    await events.click(await screen.findByRole('radio', { name: 'An organization' }));
    await events.click(await screen.findByRole('combobox', { name: 'Organization' }));
    await events.click(await screen.findByRole('option', { name: 'Acme' }));

    expect(await screen.findByText('This person gets an invitation link.')).toBeTruthy();
  });

  it('says when to try again a refused read of the projects, never "No active project matches." (#471)', async () => {
    fake.on('GET /api/v1/projects', {
      data: { items: [{ id: PROJECT_ID, key: 'ERP', name: 'ERP system' }], nextCursor: null },
    });
    fake.refuse('GET /api/v1/projects');
    const events = userEvent.setup();
    renderInApp(<InviteDialog kind="team" />);

    await events.click(screen.getByRole('button', { name: 'Invite' }));
    await events.click(await screen.findByRole('combobox', { name: 'Project' }));

    // The open list says the projects are missing; Tab closes it, as the list is no stop of Tab
    // (WAI-ARIA APG), and reaches **Try again** next to the error below the input.
    expect(await screen.findByText('The projects could not be loaded.')).toBeTruthy();
    expect(screen.queryByText('No active project matches.')).toBeNull();
    await events.tab();
    expect(document.activeElement?.textContent).toBe('Try again');
    const alert = await screen.findByRole('alert');
    // `h3` under the `h2` title of the dialog; **Try again** reads the list again, so no **Reload
    // page**, which would close the dialog.
    expect(within(alert).getByRole('heading', { level: 3 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(within(alert).queryByRole('link')).toBeNull();
    fake.answer('GET /api/v1/projects');
    await events.keyboard('{Enter}');
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    await events.click(screen.getByRole('combobox', { name: 'Project' }));
    expect(await screen.findByRole('option', { name: 'ERP system (ERP)' })).toBeTruthy();
  });

  it('shows the message of a failed read of the organizations (#471)', async () => {
    fake.on('GET /api/v1/organizations', { status: 500, error: {} });
    const events = userEvent.setup();
    renderInApp(<InviteDialog email="anna@acme.com" kind="end_user" />);

    await events.click(screen.getByRole('button', { name: 'Invite anna@acme.com' }));
    await events.click(await screen.findByRole('radio', { name: 'An organization' }));
    await events.click(await screen.findByRole('combobox', { name: 'Organization' }));

    expect(await screen.findByText('The organizations could not be loaded.')).toBeTruthy();
    expect(screen.queryByText('No active organization matches.')).toBeNull();
    await events.tab();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Try again later.',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('stops reading the pages of a list at a failed page, and keeps the items found (#471)', async () => {
    fake.on(
      'GET /api/v1/organizations',
      laterPagesFail([{ id: PROJECT_ID, name: 'Acme', state: 'active' }]),
    );
    const events = userEvent.setup();
    renderInApp(<InviteDialog email="anna@acme.com" kind="end_user" />);

    await events.click(screen.getByRole('button', { name: 'Invite anna@acme.com' }));
    await events.click(await screen.findByRole('radio', { name: 'An organization' }));
    await events.click(await screen.findByRole('combobox', { name: 'Organization' }));

    expect(await screen.findByText('The organizations could not be loaded.')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Acme' })).toBeTruthy();
    // The failed page is not read again on its own, which would use up the rate limit.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.callsTo('GET /api/v1/organizations')).toHaveLength(2);
    // **Try again** reads only the failed page again, not the pages loaded before it.
    await events.tab();
    await events.keyboard('{Enter}');
    await waitFor(() => expect(fake.callsTo('GET /api/v1/organizations')).toHaveLength(3));
    expect(fake.callsTo('GET /api/v1/organizations')[2]!.init).toMatchObject({
      params: { query: { cursor: 'next' } },
    });
  });
});

describe('AddMemberDialog', () => {
  const candidate = {
    id: '0199a3f0-0000-7000-8000-000000000002',
    displayName: 'Dev Eloper',
    githubLogin: 'developer',
  };

  it('adds a team account picked from the list', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', {
      data: { items: [candidate], nextCursor: null },
    });
    fake.on('POST /api/v1/projects/{projectId}/members', { status: 201, data: {} });
    const events = userEvent.setup();
    renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));
    await events.click(await screen.findByRole('radio', { name: /Dev Eloper/ }));
    await events.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(fake.callsTo('POST /api/v1/projects/{projectId}/members')).toHaveLength(1),
    );
    expect(fake.callsTo('POST /api/v1/projects/{projectId}/members')[0]!.init).toMatchObject({
      body: { userId: candidate.id, role: 'developer' },
    });
    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Dev Eloper added to the project' }),
      ),
    );
  });

  it('says so when no team account is left to add, and searches by text', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', {
      data: { items: [], nextCursor: null },
    });
    const events = userEvent.setup();
    renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));
    await events.type(await screen.findByRole('searchbox'), 'dev');

    await waitFor(() =>
      expect(
        fake
          .callsTo('GET /api/v1/projects/{projectId}/member-candidates')
          .some((call) => JSON.stringify(call.init).includes('"query":"dev"')),
      ).toBe(true),
    );
  });

  it('says when to try again a refused search of the accounts, and searches again (#471)', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', {
      data: { items: [candidate], nextCursor: null },
    });
    fake.refuse('GET /api/v1/projects/{projectId}/member-candidates');
    const events = userEvent.setup();
    renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));

    const alert = await screen.findByRole('alert');
    // `h3` under the `h2` title of the dialog; **Try again** searches again, so no **Reload page**.
    expect(within(alert).getByRole('heading', { level: 3 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(within(alert).queryByRole('link')).toBeNull();
    expect(screen.queryByText('No active team members match.')).toBeNull();
    fake.answer('GET /api/v1/projects/{projectId}/member-candidates');
    await events.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('radio', { name: /Dev Eloper/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the message of a failed search of the accounts, never an empty list (#471)', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', { status: 500, error: {} });
    const events = userEvent.setup();
    renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Try again later.',
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('keeps the accounts shown when a search again fails, with its error below (#471)', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', {
      data: { items: [candidate], nextCursor: null },
    });
    const events = userEvent.setup();
    const { client } = renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));
    await events.click(await screen.findByRole('radio', { name: /Dev Eloper/ }));
    // The search again on focus, after the cache time, is refused.
    fake.refuse('GET /api/v1/projects/{projectId}/member-candidates');
    await act(() => client.refetchQueries());

    expect((await screen.findByRole('alert')).textContent).toContain('Try again in 45 seconds.');
    expect(screen.getByRole('radio', { name: /Dev Eloper/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toHaveProperty('disabled', false);
  });

  it('shows the error of a refused addition under the form', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', {
      data: { items: [candidate], nextCursor: null },
    });
    fake.on('POST /api/v1/projects/{projectId}/members', { status: 500, error: {} });
    const events = userEvent.setup();
    renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));
    await events.click(await screen.findByRole('radio', { name: /Dev Eloper/ }));
    await events.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('invites by e-mail address and shows the link', async () => {
    fake.on('GET /api/v1/projects/{projectId}/member-candidates', {
      data: { items: [], nextCursor: null },
    });
    fake.on('POST /api/v1/invitation-previews', {
      data: { outcome: 'invite', organization: null },
    });
    fake.on('POST /api/v1/invitations', {
      status: 201,
      data: {
        outcome: 'invited',
        invitation: invitation({ target: { type: 'administrator' } }),
        link: LINK,
      },
    });
    const events = userEvent.setup();
    renderInApp(<AddMemberDialog projectId={PROJECT_ID} />);

    await events.click(screen.getByRole('button', { name: 'Add member' }));
    await events.click(await screen.findByRole('radio', { name: 'By e-mail address' }));
    // Pasted, not typed, like `inviteAdministrator()` above (#319).
    await events.click(await screen.findByRole('textbox', { name: 'E-mail address' }));
    await events.paste('new@acme.com');
    await events.click(await screen.findByRole('button', { name: 'Invite' }));

    expect(await screen.findByDisplayValue(LINK)).toBeTruthy();
  });
});

describe('AccountInvitations', () => {
  const account: User = {
    id: '0199a3f0-0000-7000-8000-000000000001',
    displayName: null,
    email: 'new@acme.com',
    kind: 'team',
    state: 'invited',
    isAdmin: false,
    githubLogin: null,
    createdAt: '2026-10-29T09:30:00.000Z',
    pendingInvitationCount: 1,
    allowedActions: [],
  };
  const renderAccount = () =>
    renderInApp(
      <AccountInvitations
        user={account}
        pageAccounts={[account]}
        wrap={(content) => <div data-testid="wrap">{content}</div>}
      />,
    );

  it('says when to try again a refused read of the invitations, and reads them again (#471)', async () => {
    fake.on('GET /api/v1/invitations', { data: { items: [invitation()], nextCursor: null } });
    fake.refuse('GET /api/v1/invitations');
    const events = userEvent.setup();
    renderAccount();

    const alert = await screen.findByRole('alert');
    // `h3` under the `h2` of the Accounts page; **Try again** reads the invitations again, so no
    // **Reload page**, which would drop the accounts loaded with **Load more**.
    expect(within(alert).getByRole('heading', { level: 3 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(within(alert).queryByRole('link')).toBeNull();
    fake.answer('GET /api/v1/invitations');
    await events.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('list', { name: 'Pending invitations of new@acme.com' }),
    ).toBeTruthy();
  });

  it('announces a failed read once for the page of accounts, and says so at every account (#471)', async () => {
    const other: User = {
      ...account,
      id: '0199a3f0-0000-7000-8000-000000000002',
      email: 'b@acme.com',
    };
    fake.on('GET /api/v1/invitations', { status: 500, error: {} });
    renderInApp(
      <>
        {[account, other].map((user) => (
          <AccountInvitations
            key={user.id}
            user={user}
            pageAccounts={[account, other]}
            wrap={(content) => <div data-testid={`wrap-${user.email}`}>{content}</div>}
          />
        ))}
      </>,
    );

    expect((await screen.findAllByRole('alert')).map((alert) => alert.textContent)).toEqual([
      'Something went wrong. Try again later.',
    ]);
    expect(within(screen.getByTestId('wrap-new@acme.com')).getByRole('alert')).toBeTruthy();
    expect(
      within(screen.getByTestId('wrap-b@acme.com')).getByText(
        'The invitations could not be loaded.',
      ),
    ).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Try again' })).toHaveLength(1);
  });

  it('leaves the accounts without invitations as they are while the read of the page fails (#471)', async () => {
    const noLink: User = {
      ...account,
      id: '0199a3f0-0000-7000-8000-000000000003',
      email: 'c@acme.com',
      pendingInvitationCount: 0,
    };
    const active: User = { ...noLink, id: '0199a3f0-0000-7000-8000-000000000004', state: 'active' };
    const page = [account, noLink, active];
    fake.on('GET /api/v1/invitations', { status: 500, error: {} });
    renderInApp(
      <>
        {page.map((user) => (
          <AccountInvitations
            key={user.id}
            user={user}
            pageAccounts={page}
            wrap={(content) => <div data-testid={`wrap-${user.id}`}>{content}</div>}
          />
        ))}
      </>,
    );

    await screen.findByRole('alert');
    // The invited account without a working link is still offered **Invite**; the active one
    // shows nothing – not even its row.
    expect(
      within(screen.getByTestId(`wrap-${noLink.id}`)).getByText('No working invitation link.'),
    ).toBeTruthy();
    expect(screen.queryByTestId(`wrap-${active.id}`)).toBeNull();
  });

  it('keeps the invitations shown when a read again fails, with its error below (#471)', async () => {
    fake.on('GET /api/v1/invitations', { data: { items: [invitation()], nextCursor: null } });
    const { client } = renderInApp(
      <AccountInvitations
        user={account}
        pageAccounts={[account]}
        wrap={(content) => <div data-testid="wrap">{content}</div>}
      />,
    );
    await screen.findByRole('list', { name: 'Pending invitations of new@acme.com' });

    fake.refuse('GET /api/v1/invitations');
    await act(() => client.refetchQueries());

    expect((await screen.findByRole('alert')).textContent).toContain('Try again in 45 seconds.');
    expect(screen.getByRole('list', { name: 'Pending invitations of new@acme.com' })).toBeTruthy();
  });

  it('shows the message of a failed read of the invitations, which never just disappear (#471)', async () => {
    fake.on('GET /api/v1/invitations', { status: 500, error: {} });
    renderAccount();

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Something went wrong. Try again later.',
    );
    expect(screen.getByTestId('wrap')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });
});

describe('PendingInvitationList', () => {
  function renderList(onLoadMore = vi.fn(), hasNextPage = false) {
    return renderInApp(
      <PendingInvitationList
        aria-label="Pending"
        invitations={[invitation()] as never}
        titleOf={(item) => item.user.email ?? ''}
        detailOf={() => 'Developer'}
        paging={{
          hasNextPage,
          isFetchingNextPage: false,
          error: null,
          headingLevel: 4,
          onLoadMore,
        }}
      />,
    );
  }

  it('creates a new link after the confirmation and shows it', async () => {
    fake.on('POST /api/v1/invitations/{invitationId}/resending', {
      data: { invitation: invitation(), link: LINK },
    });
    const events = userEvent.setup();
    renderList();

    await events.click(screen.getByRole('button', { name: 'Copy a new link for new@acme.com' }));
    expect(fake.callsTo('POST /api/v1/invitations/{invitationId}/resending')).toHaveLength(0);
    const dialog = await screen.findByRole('dialog');
    await events.click(within(dialog).getByRole('button', { name: 'Create new link' }));

    expect(await screen.findByDisplayValue(LINK)).toBeTruthy();
  });

  it('revokes after the confirmation', async () => {
    fake.on('POST /api/v1/invitations/{invitationId}/revocation', { data: {} });
    const events = userEvent.setup();
    renderList();

    await events.click(
      screen.getByRole('button', { name: 'Revoke the invitation of new@acme.com' }),
    );
    const dialog = await screen.findByRole('dialog');
    await events.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ title: 'Invitation revoked' })),
    );
  });

  it('confirms a revocation that removed the list meanwhile', async () => {
    // The last invitation of an account: the refreshed account removes the list before the answer.
    const answer = Promise.withResolvers<unknown>();
    fake.client.POST.mockImplementationOnce(() => answer.promise as never);
    const events = userEvent.setup();
    const { unmount } = renderList();

    await events.click(
      screen.getByRole('button', { name: 'Revoke the invitation of new@acme.com' }),
    );
    await events.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }),
    );
    unmount();
    answer.resolve({ data: {}, response: new Response(null, { status: 200 }) });

    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ title: 'Invitation revoked' })),
    );
  });

  const actions = [
    {
      action: 'Revoke',
      route: 'POST /api/v1/invitations/{invitationId}/revocation',
      open: 'Revoke the invitation of new@acme.com',
      confirm: 'Revoke',
    },
    {
      action: 'Copy new link',
      route: 'POST /api/v1/invitations/{invitationId}/resending',
      open: 'Copy a new link for new@acme.com',
      confirm: 'Create new link',
    },
  ];
  const problem = (status: number, code: string) => ({
    status,
    error: { type: 'about:blank', title: 'x', status, code },
  });

  async function confirmRefused(
    { route, open, confirm }: (typeof actions)[number],
    reply: { status: number; error: unknown },
  ) {
    fake.on(route, reply);
    const events = userEvent.setup();
    renderList();

    await events.click(screen.getByRole('button', { name: open }));
    await events.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: confirm }),
    );
    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    );
  }

  describe.each(actions)('a refused $action', (action) => {
    it.each([
      [
        'accepted or revoked meanwhile',
        problem(409, 'invitation.not_pending'),
        'This invitation was already accepted or revoked.',
      ],
      [
        'no longer visible',
        problem(404, 'request.not_found'),
        'This item does not exist or you do not have access to it.',
      ],
    ])('closes the confirmation of an invitation %s', async (_, reply, message) => {
      await confirmRefused(action, reply);

      expect(toasts).toHaveBeenCalledWith({ title: message, type: 'error' });
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('keeps the confirmation open to try again after any other error', async () => {
      await confirmRefused(action, problem(500, 'server.internal_error'));

      expect(toasts).toHaveBeenCalledWith({
        title: 'Something went wrong. Try again later.',
        type: 'error',
      });
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(
        within(screen.getByRole('dialog')).getByRole('button', { name: action.confirm }),
      ).toBeTruthy();
    });
  });

  it('closes only the confirmation of the refused invitation', async () => {
    // Revoking A is cancelled while it is sent and B's confirmation opened; A's refusal arrives then.
    const answer = Promise.withResolvers<unknown>();
    fake.client.POST.mockImplementationOnce(() => answer.promise as never);
    const other = invitation({
      id: '0199a3f0-0000-7000-8000-000000000051',
      user: { id: '0199a3f0-0000-7000-8000-000000000002', email: 'b@acme.com', displayName: null },
    });
    const events = userEvent.setup();
    renderInApp(
      <PendingInvitationList
        invitations={[invitation(), other] as never}
        titleOf={(item) => item.user.email ?? ''}
      />,
    );

    await events.click(
      screen.getByRole('button', { name: 'Revoke the invitation of new@acme.com' }),
    );
    await events.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Revoke' }),
    );
    await events.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await events.click(screen.getByRole('button', { name: 'Revoke the invitation of b@acme.com' }));
    expect(await screen.findByRole('dialog', { name: /b@acme\.com/ })).toBeTruthy();
    answer.resolve({
      error: problem(409, 'invitation.not_pending').error,
      response: new Response(null, { status: 409 }),
    });

    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith({
        title: 'This invitation was already accepted or revoked.',
        type: 'error',
      }),
    );
    expect(screen.getByRole('dialog', { name: /b@acme\.com/ })).toBeTruthy();
  });

  it('loads more invitations on request', async () => {
    const onLoadMore = vi.fn();
    const events = userEvent.setup();
    renderList(onLoadMore, true);

    await events.click(screen.getByRole('button', { name: 'Show more' }));

    expect(onLoadMore).toHaveBeenCalled();
  });
});

describe('ProjectInvitations', () => {
  // The invitation is accepted or revoked by someone else while the confirmation is open: the
  // refused action closes it, and the refreshed list no longer shows the invitation – the last of
  // the project, so the whole list goes and the refusal must still be reported (#368). The project
  // of the Members tab is read again too; its answer comes only after the list went.
  function ProjectRead({ answer }: { answer: Promise<unknown> }) {
    useQuery({ queryKey: ['projects', 'detail', PROJECT_ID], queryFn: () => answer });
    return null;
  }

  it.each([
    ['Revoke', 'revocation', 'Revoke the invitation of new@acme.com', 'Revoke'],
    ['Copy new link', 'resending', 'Copy a new link for new@acme.com', 'Create new link'],
  ])('reports a refused %s and drops the invitation', async (_, path, open, confirm) => {
    const pages = [[invitation()], []];
    fake.on('GET /api/v1/invitations', () => ({
      data: { items: pages.shift() ?? [], nextCursor: null },
    }));
    fake.on(`POST /api/v1/invitations/{invitationId}/${path}`, {
      status: 409,
      error: { type: 'about:blank', title: 'x', status: 409, code: 'invitation.not_pending' },
    });
    const project = Promise.withResolvers<unknown>();
    const events = userEvent.setup();
    renderInApp(
      <>
        <ProjectInvitations projectId={PROJECT_ID} />
        <ProjectRead answer={project.promise} />
      </>,
    );

    await events.click(await screen.findByRole('button', { name: open }));
    await events.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: confirm }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Pending invitations' })).toBeNull(),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    project.resolve({});
    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith({
        title: 'This invitation was already accepted or revoked.',
        type: 'error',
      }),
    );
  });
});

describe('InvitationOffer', () => {
  it.each([
    ['en', 'Too many requests', 'Try again in 45 seconds.', 'Reload page', 'not valid'],
    ['pl', 'Zbyt wiele żądań', 'Spróbuj ponownie za 45 sekund.', 'Odśwież stronę', 'nieważny'],
  ] as const)(
    'says in %s that a refused check is a limit, not an invalid link, and reloads with the token (#433)',
    async (locale, title, wait, reload, invalid) => {
      // The link of the e-mail, with its token in the fragment of the address (ADR 0009).
      window.history.replaceState(null, '', '/invitations#token=abc');
      fake.client.POST.mockImplementationOnce(() => rateLimitedResult());
      renderInApp(<InvitationOffer token="abc" language={locale} endUserProviders={[]} />, {
        locale,
      });

      const alert = await screen.findByRole('alert');
      // `h2` under the `h1` of the page.
      expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe(title);
      expect(alert.textContent).toContain(wait);
      expect(alert.textContent).not.toMatch(new RegExp(invalid, 'i'));
      // A link to the address would only scroll to the fragment, one without it would lose the
      // token: **Reload page** reloads the document instead.
      expect(within(alert).getByRole('button', { name: reload })).toBeTruthy();
      expect(within(alert).queryByRole('link')).toBeNull();
    },
  );
});

describe('ContinueAcceptance', () => {
  const accepted = (kind: 'end_user' | 'team', landingPath = '/projects') => ({
    data: { kind, landingPath },
  });

  it('accepts with the new session and leaves for the landing path of an end user', async () => {
    fake.on('POST /api/v1/invitations/acceptance', accepted('end_user', '/'));
    const pending = { step: 'accept', token: 't', signIns: 0 } as const;
    writePendingAcceptance(window.sessionStorage, pending);
    renderInApp(<ContinueAcceptance pending={pending} language="en" />);

    expect(screen.getByRole('status').textContent).toBe('Accepting the invitation…');
    await waitFor(() => expect(readPendingAcceptance(window.sessionStorage)).toBeUndefined());
    expect(fake.callsTo('POST /api/v1/invitations/acceptance')[0]!.init).toMatchObject({
      body: { method: 'identity_provider', token: 't', language: 'en' },
    });
  });

  it('keeps a team member on the page to verify the second factor', async () => {
    fake.on('POST /api/v1/invitations/acceptance', accepted('team', '/projects'));
    const pending = { step: 'accept', token: 't', provider: 'github', signIns: 0 } as const;
    renderInApp(<ContinueAcceptance pending={pending} language="en" />);

    await waitFor(() =>
      expect(readPendingAcceptance(window.sessionStorage)).toMatchObject({
        step: 'verify',
        landingPath: '/projects',
        provider: 'github',
      }),
    );
  });

  it('signs in again when the session lacks the second factor', async () => {
    fake.on('POST /api/v1/invitations/acceptance', {
      status: 401,
      error: {
        type: 'about:blank',
        title: 'x',
        status: 401,
        code: 'authentication.second_factor_required',
      },
    });
    const pending = { step: 'accept', token: 't', provider: 'github', signIns: 1 } as const;
    renderInApp(<ContinueAcceptance pending={pending} language="pl" />);

    await waitFor(() =>
      expect(signInToContinue).toHaveBeenCalledWith({ ...pending, signIns: 2 }, { locale: 'pl' }),
    );
    expect(await screen.findByText(/one-time code|jednorazow/i)).toBeTruthy();
  });

  it('explains an invalid link', async () => {
    fake.on('POST /api/v1/invitations/acceptance', {
      status: 404,
      error: { type: 'about:blank', title: 'x', status: 404, code: 'invitation.token_invalid' },
    });
    renderInApp(
      <ContinueAcceptance pending={{ step: 'accept', token: 't', signIns: 0 }} language="en" />,
    );

    expect(await screen.findByText('This invitation link is not valid')).toBeTruthy();
  });

  it('offers to sign out when the session belongs to another account', async () => {
    fake.on('POST /api/v1/invitations/acceptance', {
      status: 409,
      error: { type: 'about:blank', title: 'x', status: 409, code: 'invitation.account_mismatch' },
    });
    const events = userEvent.setup();
    renderInApp(
      <ContinueAcceptance pending={{ step: 'accept', token: 't', signIns: 0 }} language="en" />,
    );

    await events.click(await screen.findByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(signOutInPlace).toHaveBeenCalled());
  });

  it('offers to try again after any other failure', async () => {
    fake.on('POST /api/v1/invitations/acceptance', { status: 500, error: {} });
    renderInApp(
      <ContinueAcceptance pending={{ step: 'accept', token: 't', signIns: 0 }} language="en" />,
    );

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('says when to try again a refused check of the session, without signing in (#433)', async () => {
    fake.client.GET.mockImplementationOnce(() => rateLimitedResult());
    const pending = {
      step: 'verify',
      landingPath: '/projects',
      provider: 'github',
      signIns: 0,
    } as const;
    writePendingAcceptance(window.sessionStorage, pending);
    renderInApp(<ContinueAcceptance pending={pending} language="en" />);

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('heading', { level: 2 }).textContent).toBe('Too many requests');
    expect(alert.textContent).toContain('Try again in 45 seconds.');
    expect(alert.textContent).not.toContain('Too many requests. Wait a moment and try again.');
    // The step stays in the tab, so the reloaded page checks the session again.
    expect(within(alert).getByRole('link', { name: 'Reload page' }).getAttribute('href')).toBe(
      '/invitations',
    );
    expect(readPendingAcceptance(window.sessionStorage)).toEqual(pending);
    expect(signInToContinue).not.toHaveBeenCalled();
  });

  describe('verifying the second factor', () => {
    const verify = (signIns: number) =>
      ({ step: 'verify', landingPath: '/projects', provider: 'github', signIns }) as const;

    it('lands once the session is complete', async () => {
      fake.on('GET /api/v1/users/me', { data: { id: 'u' } });
      writePendingAcceptance(window.sessionStorage, verify(0));
      renderInApp(<ContinueAcceptance pending={verify(0)} language="en" />);

      await waitFor(() => expect(readPendingAcceptance(window.sessionStorage)).toBeUndefined());
    });

    it('signs in for the second factor while the sign-ins last', async () => {
      fake.on('GET /api/v1/users/me', {
        status: 401,
        error: {
          type: 'about:blank',
          title: 'x',
          status: 401,
          code: 'authentication.second_factor_required',
        },
      });
      renderInApp(<ContinueAcceptance pending={verify(0)} language="en" />);

      await waitFor(() =>
        expect(signInToContinue).toHaveBeenCalledWith(
          { ...verify(0), signIns: 1 },
          { locale: 'en' },
        ),
      );
    });

    it('gives up after the last sign-in and offers Sign in', async () => {
      fake.on('GET /api/v1/users/me', {
        status: 401,
        error: {
          type: 'about:blank',
          title: 'x',
          status: 401,
          code: 'authentication.second_factor_required',
        },
      });
      const events = userEvent.setup();
      renderInApp(<ContinueAcceptance pending={verify(3)} language="en" />);

      await events.click(await screen.findByRole('button', { name: 'Sign in' }));

      expect(signInToContinue).toHaveBeenCalledWith({ ...verify(0), signIns: 1 }, { locale: 'en' });
    });
  });
});

describe('PasswordAcceptanceForm', () => {
  it.each([
    ['en', 'Accept and sign in', ['Enter your first name', 'Enter your last name']],
    ['pl', 'Przyjmij i zaloguj się', ['Podaj imię', 'Podaj nazwisko']],
  ] as const)(
    'asks for a missing first and last name instead of calling them too short (%s)',
    async (locale, submit, messages) => {
      const events = userEvent.setup();
      renderInApp(
        <PasswordAcceptanceForm
          token="abc"
          email="anna@customer.example.com"
          language={locale}
          onTokenRejected={() => {}}
        />,
        { locale },
      );

      await events.type(
        screen.getByRole('textbox', { name: locale === 'en' ? 'Last name' : 'Nazwisko' }),
        ' ',
      );
      await events.click(screen.getByRole('button', { name: submit }));

      for (const message of messages) {
        expect(await screen.findByText(message)).toBeDefined();
      }
      // Only the empty password is too short.
      expect(screen.getAllByText(locale === 'en' ? 'Too short' : 'Za krótkie')).toHaveLength(1);
      expect(fake.callsTo('POST /api/v1/invitations/acceptance')).toHaveLength(0);
    },
  );
});
