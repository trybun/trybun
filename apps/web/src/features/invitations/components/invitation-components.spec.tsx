import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { InvitationToAccept } from '@trybun/contracts/invitations';
import { CATALOGUES } from '@trybun/i18n/catalogues';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({ signIn: vi.fn(), signOut: vi.fn() }));

const { InvitationLink } = await import('./invitation-link.js');
const { InvitationPreviewLine } = await import('./invitation-preview-line.js');
const { InvitationSummary } = await import('./invitation-summary.js');
const { InvitationOffer } = await import('./invitation-offer.js');
const { InvitationAcceptance } = await import('./invitation-acceptance.js');
const { ContinueAcceptance } = await import('./continue-acceptance.js');
const { ApiError } = await import('../../../lib/errors/api-error.js');

const TOKEN = 'token-of-the-link';

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

function invitation(overrides: Partial<InvitationToAccept> = {}): InvitationToAccept {
  return {
    email: 'anna@customer.example.com',
    kind: 'end_user',
    accountState: 'invited',
    target: {
      type: 'project',
      project: { id: '0199a3f0-0000-7000-8000-000000000010', key: 'CP', name: 'Customer portal' },
      role: 'end_user',
      organization: null,
    },
    invitedBy: { displayName: 'Marek Manager' },
    expiresAt: '2026-11-05T09:30:00.000Z',
    ...overrides,
  };
}

/** The acceptance page of a link whose check answered `value`. */
function renderOffer(
  value: InvitationToAccept,
  endUserProviders: ('microsoft' | 'google')[] = [],
  locale: 'en' | 'pl' = 'en',
) {
  return render(
    <InvitationOffer token={TOKEN} language={locale} endUserProviders={endUserProviders} />,
    {
      locale,
      seed: (client) => client.setQueryData(['invitations', 'token-verification', TOKEN], value),
    },
  );
}

describe('InvitationLink', () => {
  it('shows the link with Copy link and the note that only this link works until it expires', () => {
    const html = render(
      <InvitationLink
        link={`https://trybun.example.com/invitations#token=${TOKEN}`}
        expiresAt="2026-11-05T09:30:00.000Z"
      />,
    );

    expect(html).toContain(`value="https://trybun.example.com/invitations#token=${TOKEN}"`);
    expect(html).toContain('readOnly');
    expect(html).toContain('Copy link');
    expect(html).toContain('Only this link works. It expires on Nov 5, 2026, 9:30');
  });

  it('is translated', () => {
    const html = render(
      <InvitationLink link="https://x.example/i" expiresAt="2026-11-05T09:30:00.000Z" />,
      {
        locale: 'pl',
      },
    );

    expect(html).toContain('Skopiuj link');
    expect(html).toContain('Działa tylko ten link.');
  });
});

describe('InvitationPreviewLine', () => {
  it.each([
    [{ outcome: 'invite', organization: null }, 'This person gets an invitation link.'],
    [
      { outcome: 'invite', organization: { id: 'o', name: 'Customer company' } },
      'This person will join the organization Customer company.',
    ],
    [
      { outcome: 'grant', organization: null },
      'This person already has an account and gets the access at once.',
    ],
  ] as const)('says what sending will do: %j', (preview, text) => {
    expect(
      render(<InvitationPreviewLine preview={preview} error={null} isChecking={false} />),
    ).toContain(text);
  });

  it('names the organization in Polish as the specification words it', () => {
    expect(
      render(
        <InvitationPreviewLine
          preview={{ outcome: 'invite', organization: { id: 'o', name: 'Firma' } }}
          error={null}
          isChecking={false}
        />,
        { locale: 'pl' },
      ),
    ).toContain('Ta osoba dołączy do organizacji Firma.');
  });

  it('shows the reason of a refusal', () => {
    const html = render(
      <InvitationPreviewLine
        preview={undefined}
        error={new ApiError(422, 'invitation.account_kind_mismatch')}
        isChecking={false}
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('This address belongs to an account of the other kind.');
  });

  it('says that it checks the address', () => {
    expect(render(<InvitationPreviewLine preview={undefined} error={null} isChecking />)).toContain(
      'Checking the address…',
    );
  });
});

describe('InvitationSummary', () => {
  it('shows the invited address read-only, the target, the inviting person and the expiry', () => {
    const html = render(<InvitationSummary invitation={invitation()} />);

    expect(html).toContain('value="anna@customer.example.com"');
    expect(html).toContain('readOnly');
    expect(html).toContain('the project Customer portal, role: End user');
    expect(html).toContain('Marek Manager');
    expect(html).toContain('Nov 5, 2026');
  });

  it.each([
    [
      { type: 'organization', organization: { id: 'o', name: 'Customer company' } },
      'the organization Customer company',
    ],
    [{ type: 'administrator' }, 'the Administrator role'],
  ] as const)('names the target %j', (target, text) => {
    expect(render(<InvitationSummary invitation={invitation({ target })} />)).toContain(text);
  });
});

describe('InvitationOffer', () => {
  it('checks the link first', () => {
    expect(render(<InvitationOffer token={TOKEN} language="en" endUserProviders={[]} />)).toContain(
      'Checking the invitation link…',
    );
  });

  it('offers an end user the password form, and no provider that is not configured', () => {
    const html = renderOffer(invitation());

    for (const text of [
      'Create your account',
      'First name',
      'Last name',
      'Password',
      'Accept and sign in',
    ]) {
      expect(html).toContain(text);
    }
    expect(html).toContain('autoComplete="new-password"');
    expect(html).not.toContain('Continue with');
  });

  it('offers an end user the configured providers', () => {
    const html = renderOffer(invitation(), ['microsoft', 'google']);

    expect(html).toContain('Continue with Microsoft');
    expect(html).toContain('Continue with Google');
    expect(html).not.toContain('GitHub');
  });

  it('offers a team member GitHub only', () => {
    const html = renderOffer(invitation({ kind: 'team' }), ['microsoft', 'google']);

    expect(html).toContain('Continue with GitHub');
    expect(html).toContain('two-factor authentication');
    expect(html).not.toContain('Continue with Microsoft');
    expect(html).not.toContain('Password');
  });

  it('asks an existing account to sign in to accept a further link', () => {
    const html = renderOffer(invitation({ accountState: 'active' }), ['microsoft']);

    expect(html).toContain('You already have an account with this address.');
    expect(html).toContain('Sign in to accept');
    expect(html).not.toContain('Password');
  });

  it('is translated', () => {
    const html = renderOffer(invitation(), ['google'], 'pl');

    expect(html).toContain('Utwórz konto');
    expect(html).toContain('Kontynuuj z Google');
    expect(html).toContain('projektu Customer portal, rola: Użytkownik');
  });
});

describe('InvitationAcceptance', () => {
  it('reads the link on the browser, which alone knows the fragment of the address', () => {
    expect(render(<InvitationAcceptance endUserProviders={[]} />)).toContain(
      'Checking the invitation link…',
    );
  });
});

describe('ContinueAcceptance', () => {
  it('accepts after a provider sign-in', () => {
    expect(
      render(
        <ContinueAcceptance
          pending={{ step: 'accept', token: TOKEN, provider: 'google', signIns: 0 }}
          language="en"
        />,
      ),
    ).toContain('Accepting the invitation…');
  });

  it.each([
    [0, 'Sign in once more with a one-time code'],
    [3, 'The invitation could not be accepted'],
  ])(
    'signs in again for a missing second factor after %i sign-ins, then offers a sign-in',
    (signIns, text) => {
      const html = render(
        <ContinueAcceptance
          pending={{ step: 'verify', landingPath: '/', provider: 'github', signIns }}
          language="en"
        />,
        {
          seed: (client) => {
            // The check failed already; the page acts on that answer instead of asking again.
            client.setDefaultOptions({ queries: { retryOnMount: false } });
            client
              .getQueryCache()
              .build(client, { queryKey: ['users', 'me'] })
              .setState({
                status: 'error',
                error: new ApiError(401, 'authentication.second_factor_required'),
                fetchStatus: 'idle',
              });
          },
        },
      );

      expect(html).toContain(text);
    },
  );

  it('checks the second factor of a bound team member before landing', () => {
    expect(
      render(
        <ContinueAcceptance
          pending={{ step: 'verify', landingPath: '/', provider: 'github', signIns: 1 }}
          language="en"
        />,
      ),
    ).toContain('Accepting the invitation…');
  });
});
