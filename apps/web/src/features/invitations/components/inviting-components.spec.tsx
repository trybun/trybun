import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import type { User } from '@trybun/contracts/users';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { Dialog } from '@trybun/ui/components/dialog';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement, ReactNode } from 'react';
import { prerender } from 'react-dom/static';
import { describe, expect, it } from 'vitest';

const { AccountInvitations } = await import('./account-invitations.js');
const { InviteDialog } = await import('./invite-dialog.js');
const { InvitationForm } = await import('./invitation-form.js');

const USER_ID = '0199a3f0-0000-7000-8000-000000000021';
const PROJECT_ID = '0199a3f0-0000-7000-8000-000000000010';

/** The server HTML with the lazily loaded components resolved (§18.7). */
async function render(
  element: ReactElement,
  {
    locale = 'en',
    seed = () => {},
  }: { locale?: 'en' | 'pl'; seed?: (client: QueryClient) => void } = {},
): Promise<string> {
  const queryClient = new QueryClient();
  seed(queryClient);
  const { prelude } = await prerender(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return new Response(prelude).text();
}

function user(overrides: Partial<User> = {}): User {
  return {
    id: USER_ID,
    displayName: null,
    email: 'ewa@customer.example.com',
    kind: 'end_user',
    state: 'invited',
    isAdmin: false,
    githubLogin: null,
    createdAt: '2026-10-29T09:00:00.000Z',
    allowedActions: ['deactivate'],
    ...overrides,
  };
}

function invitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: '0199a3f0-0000-7000-8000-000000000030',
    user: { id: USER_ID, email: 'ewa@customer.example.com', displayName: null },
    target: {
      type: 'project',
      project: { id: PROJECT_ID, key: 'CP', name: 'Customer portal' },
      role: 'end_user',
      organization: null,
    },
    invitedBy: { id: '0199a3f0-0000-7000-8000-000000000001', displayName: 'Ada Admin' },
    state: 'pending',
    expiresAt: '2026-11-05T09:00:00.000Z',
    createdAt: '2026-10-29T09:00:00.000Z',
    allowedActions: ['resend', 'revoke'],
    ...overrides,
  };
}

/** The pending invitations of the account on the Accounts page, the API answering `items`. */
function renderAccount(account: User, items: Invitation[] | null, locale: 'en' | 'pl' = 'en') {
  return render(
    <AccountInvitations
      user={account}
      wrap={(content: ReactNode) => <div data-testid="wrap">{content}</div>}
    />,
    {
      locale,
      seed: (client) =>
        items !== null &&
        client.setQueryData(['invitations', 'list', { userId: USER_ID }], {
          pages: [{ items, nextCursor: null }],
          pageParams: [null],
        }),
    },
  );
}

describe('AccountInvitations', () => {
  it('lists the target, inviting person and expiry of each pending invitation with its actions', async () => {
    const html = await renderAccount(user(), [
      invitation(),
      invitation({
        id: '0199a3f0-0000-7000-8000-000000000031',
        target: {
          type: 'organization',
          organization: { id: '0199a3f0-0000-7000-8000-000000000040', name: 'Customer company' },
        },
        invitedBy: null,
        allowedActions: ['revoke'],
      }),
    ]);

    expect(html).toContain('aria-label="Pending invitations of ewa@customer.example.com"');
    expect(html).toContain('Project Customer portal, End user');
    expect(html).toContain('Invited by Ada Admin');
    expect(html).toContain('Expires on Nov 5, 2026');
    expect(html).toContain(
      'aria-label="Copy a new link for ewa@customer.example.com, Project Customer portal, End user"',
    );
    expect(html).toContain('Organization Customer company');
    expect(html).toContain('Inviting person unknown');
    expect(html).toContain(
      'aria-label="Revoke the invitation of ewa@customer.example.com, Organization Customer company"',
    );
    // The organization's invitation allows no resending.
    expect(html.match(/Copy new link/g)).toHaveLength(1);
    expect(html).not.toContain('No working invitation link.');
  });

  it('names the Administrator role, in Polish too', async () => {
    const administrator = invitation({ target: { type: 'administrator' } });

    expect(await renderAccount(user({ kind: 'team' }), [administrator])).toContain(
      'Administrator role',
    );
    expect(await renderAccount(user({ kind: 'team' }), [administrator], 'pl')).toContain(
      'Rola Administratora',
    );
  });

  it('offers Invite for the address of an invited account without a working link', async () => {
    const html = await renderAccount(user(), []);

    expect(html).toContain('data-testid="wrap"');
    expect(html).toContain('No working invitation link.');
    expect(html).toContain('aria-label="Invite ewa@customer.example.com"');
  });

  it.each([
    ['an active account without pending invitations', user({ state: 'active' }), []],
    ['a deactivated account, whose invitations were revoked', user({ state: 'deactivated' }), null],
    ['an account whose invitations are still loading', user(), null],
  ] as const)('shows nothing for %s', async (_, account, items) => {
    expect(await renderAccount(account, items === null ? null : [...items])).toBe('');
  });
});

describe('InviteDialog', () => {
  it('renders the Invite button of the page, the dialog opening on request', async () => {
    const html = await render(<InviteDialog />);

    expect(html).toContain('Invite');
    expect(html).not.toContain('aria-label="Invite');
    expect(html).not.toContain('role="dialog"');
  });

  it('names the address of an existing account', async () => {
    expect(
      await render(<InviteDialog email="ewa@customer.example.com" kind="end_user" />),
    ).toContain('aria-label="Invite ewa@customer.example.com"');
  });
});

describe('InvitationForm', () => {
  /** The form inside the dialog it belongs to, which owns its Cancel button. */
  function renderForm(props: Partial<Parameters<typeof InvitationForm>[0]> = {}) {
    return render(
      <Dialog>
        <InvitationForm onGranted={() => {}} onInvited={() => {}} {...props} />
      </Dialog>,
    );
  }

  it('offers every target on the Accounts page, a project first', async () => {
    const html = await renderForm();

    expect(html).toContain('E-mail address');
    expect(html).toContain('Invite to');
    expect(html).toContain('A project');
    expect(html).toContain('An organization');
    expect(html).toContain('The Administrator role');
    expect(html).toContain('Project');
    expect(html).toContain('Role');
    // Nothing to send before a project is picked.
    expect(html).toMatch(/<button type="submit"[^>]*disabled/);
  });

  it.each([
    ['end_user', ['A project', 'An organization'], 'The Administrator role'],
    ['team', ['A project', 'The Administrator role'], 'An organization'],
  ] as const)('offers a %s account the targets of its kind only', async (kind, offered, other) => {
    const html = await renderForm({ kind, defaultEmail: 'ewa@customer.example.com' });

    for (const target of offered) {
      expect(html).toContain(target);
    }
    expect(html).not.toContain(other);
    expect(html).toContain('value="ewa@customer.example.com"');
  });

  it('asks only for the role in the Members tab of a project', async () => {
    const html = await renderForm({ projectId: PROJECT_ID });

    expect(html).not.toContain('Invite to');
    expect(html).toContain('Role');
    expect(html).toContain('End user');
  });
});
