import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { CurrentUser, User } from '@trybun/contracts/users';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation.js', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/admin/accounts',
}));
// Server Actions, which a client component calls over the network.
vi.mock('../../../lib/i18n/change-language.js', () => ({ changeLanguage: vi.fn() }));
vi.mock('../../../lib/i18n/change-time-zone.js', () => ({ changeTimeZone: vi.fn() }));

const { AccountList } = await import('./account-list.js');
const { AccountActions } = await import('./account-actions.js');
const { AccountSettingsForm } = await import('./account-settings-form.js');

function render(
  element: ReactElement,
  {
    locale = 'en',
    seed = () => {},
  }: { locale?: 'en' | 'pl'; seed?: (client: QueryClient) => void } = {},
): string {
  const queryClient = new QueryClient();
  seed(queryClient);
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={CATALOGUES[locale]} timeZone="UTC">
      <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

function account(overrides: Partial<User> = {}): User {
  return {
    id: '0199a3f0-0000-7000-8000-000000000041',
    displayName: 'Anna Nowak',
    email: 'anna@example.com',
    kind: 'team',
    state: 'active',
    isAdmin: false,
    githubLogin: 'anowak',
    createdAt: '2026-10-29T09:00:00.000Z',
    pendingInvitationCount: 0,
    allowedActions: ['deactivate', 'grant_admin'],
    ...overrides,
  };
}

/** The Accounts page seeded with one page of accounts, without filters. */
function renderList(items: User[]) {
  return render(<AccountList />, {
    seed: (client) => {
      client.setQueryData(['users', 'list', { query: '' }], {
        pages: [{ items, nextCursor: null }],
        pageParams: [null],
      });
      for (const { id } of items) {
        client.setQueryData(['invitations', 'list', { userId: id }], {
          pages: [{ items: [], nextCursor: null }],
          pageParams: [null],
        });
      }
    },
  });
}

describe('AccountList', () => {
  it('lists each account with its address, kind, state and the Administrator role', () => {
    const html = renderList([
      account({ isAdmin: true, allowedActions: ['revoke_admin'] }),
      account({
        id: '0199a3f0-0000-7000-8000-000000000042',
        displayName: null,
        email: 'ewa@customer.example.com',
        kind: 'end_user',
        state: 'deactivated',
        githubLogin: null,
        allowedActions: ['reactivate'],
      }),
    ]);

    expect(html).toContain('Anna Nowak');
    expect(html).toContain('anna@example.com');
    expect(html).toContain('ewa@customer.example.com');
    expect(html).toContain(CATALOGUES.en.users.accounts.administrator);
    expect(html).toContain(CATALOGUES.en.users.accounts.states.deactivated);
    expect(html).toContain(CATALOGUES.en.users.accounts.kinds.end_user);
    expect(html).toContain('aria-label="Actions for Anna Nowak"');
  });

  it('says when no account matches the filters', () => {
    expect(renderList([])).toContain(CATALOGUES.en.users.accounts.empty);
  });

  it('offers the filters by kind and state and the search', () => {
    const html = renderList([account()]);

    expect(html).toContain(CATALOGUES.en.users.accounts.search);
    expect(html).toContain(CATALOGUES.en.users.accounts.allKinds);
    expect(html).toContain(CATALOGUES.en.users.accounts.allStates);
  });
});

describe('AccountActions', () => {
  it('offers the actions menu of an account with allowed actions', () => {
    expect(render(<AccountActions user={account()} name="Anna Nowak" />)).toContain(
      'aria-label="Actions for Anna Nowak"',
    );
  });

  it('offers nothing without an allowed action, e.g. for the own account', () => {
    expect(render(<AccountActions user={account({ allowedActions: [] })} name="Ada" />)).toBe('');
  });
});

describe('AccountSettingsForm', () => {
  function currentUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
    return {
      id: '0199a3f0-0000-7000-8000-000000000043',
      displayName: 'Anna Nowak',
      email: 'anna@example.com',
      kind: 'team',
      language: 'pl',
      timeZone: 'Europe/Warsaw',
      allowedActions: [],
      ...overrides,
    };
  }

  function renderForm(user: CurrentUser, locale: 'en' | 'pl' = 'en') {
    return render(<AccountSettingsForm systemTimeZone="UTC" />, {
      locale,
      seed: (client) => client.setQueryData(['users', 'me'], user),
    });
  }

  it('shows the language and the time zone of the account with Save', () => {
    const html = renderForm(currentUser());

    expect(html).toContain(CATALOGUES.en.users.settings.language);
    expect(html).toContain(CATALOGUES.en.languages.pl);
    expect(html).toContain(CATALOGUES.en.users.settings.timeZone);
    expect(html).toContain('value="Europe/Warsaw"');
    expect(html).toContain(CATALOGUES.en.users.settings.save);
  });

  it('names the system time zone while the account uses it', () => {
    const html = renderForm(currentUser({ language: null, timeZone: null }));

    expect(html).toContain(CATALOGUES.en.languages.en);
    expect(html).toContain('UTC');
  });

  it('is translated', () => {
    expect(renderForm(currentUser(), 'pl')).toContain(CATALOGUES.pl.users.settings.save);
  });
});
