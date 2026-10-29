// @vitest-environment jsdom
import { cleanup, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { toast } from '@trybun/ui/components/toast';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { createFakeApiClient } from '../../../../test/dom/fake-api-client.js';
import { renderInApp } from '../../../../test/dom/render.js';

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

const { InviteDialog } = await import('./invite-dialog.js');
const { AddMemberDialog } = await import('../../projects/components/add-member-dialog.js');
const { ContinueAcceptance } = await import('./continue-acceptance.js');
const { PendingInvitationList } = await import('./pending-invitation-list.js');
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
});

describe('InviteDialog', () => {
  async function inviteAdministrator(events: ReturnType<typeof userEvent.setup>) {
    renderInApp(<InviteDialog kind="team" />);
    await events.click(screen.getByRole('button', { name: 'Invite' }));
    await events.type(
      await screen.findByRole('textbox', { name: 'E-mail address' }),
      'new@acme.com',
    );
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
    await events.type(
      await screen.findByRole('textbox', { name: 'E-mail address' }),
      'new@acme.com',
    );
    await events.click(await screen.findByRole('button', { name: 'Invite' }));

    expect(await screen.findByDisplayValue(LINK)).toBeTruthy();
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
        hasNextPage={hasNextPage}
        isFetchingNextPage={false}
        onLoadMore={onLoadMore}
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

  it('shows the error of a refused revocation', async () => {
    fake.on('POST /api/v1/invitations/{invitationId}/revocation', { status: 500, error: {} });
    const events = userEvent.setup();
    renderList();

    await events.click(
      screen.getByRole('button', { name: 'Revoke the invitation of new@acme.com' }),
    );
    const dialog = await screen.findByRole('dialog');
    await events.click(within(dialog).getByRole('button', { name: 'Revoke' }));

    await waitFor(() =>
      expect(toasts).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })),
    );
  });

  it('loads more invitations on request', async () => {
    const onLoadMore = vi.fn();
    const events = userEvent.setup();
    renderList(onLoadMore, true);

    await events.click(screen.getByRole('button', { name: 'Show more' }));

    expect(onLoadMore).toHaveBeenCalled();
  });
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
