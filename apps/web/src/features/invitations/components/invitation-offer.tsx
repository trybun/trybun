'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { InvitationToAccept } from '@trybun/contracts/invitations';
import type { Language } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import { Separator } from '@trybun/ui/components/separator';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import type { IdentityProvider } from '../../sessions/keycloak-sign-in.js';
import { signInToContinue } from '../acceptance-sign-in.js';
import { invitationTokenVerificationQueryOptions } from '../queries.js';
import { InvitationMessage } from './invitation-message.js';
import { InvitationSummary } from './invitation-summary.js';
import { PasswordAcceptanceForm } from './password-acceptance-form.js';

/** The names of the providers, which are brands and not translated. */
const PROVIDER_NAMES: Record<IdentityProvider, string> = {
  github: 'GitHub',
  microsoft: 'Microsoft',
  google: 'Google',
};

/**
 * A link opened on the acceptance page (ADR 0009): checks the token, shows the invitation and the
 * ways to accept it – for a team member GitHub only; for an end user a password and the
 * configured Microsoft and Google providers; for a further link of an active account the sign-in
 * to that account. A used, expired, revoked or replaced link gets its message instead.
 */
export function InvitationOffer({
  token,
  language,
  endUserProviders,
}: {
  token: string;
  language: Language;
  endUserProviders: readonly IdentityProvider[];
}) {
  const t = useTranslations('invitations.acceptance');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const verification = useQuery(invitationTokenVerificationQueryOptions(browserApiClient, token));

  if (verification.isError) {
    return (
      <InvitationMessage title={t('invalidTitle')}>
        {errorMessage(verification.error)}
      </InvitationMessage>
    );
  }
  if (verification.data === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        {t('checking')}
      </p>
    );
  }
  const invitation = verification.data;
  return (
    <div className="flex flex-col gap-6">
      <InvitationSummary invitation={invitation} />
      <Separator />
      <AcceptanceMethods
        token={token}
        invitation={invitation}
        language={language}
        endUserProviders={endUserProviders}
        onTokenRejected={() =>
          void queryClient.invalidateQueries({
            queryKey: invitationTokenVerificationQueryOptions(browserApiClient, token).queryKey,
          })
        }
      />
    </div>
  );
}

function AcceptanceMethods({
  token,
  invitation,
  language,
  endUserProviders,
  onTokenRejected,
}: {
  token: string;
  invitation: InvitationToAccept;
  language: Language;
  endUserProviders: readonly IdentityProvider[];
  onTokenRejected: () => void;
}) {
  const t = useTranslations('invitations.acceptance');
  const [isRedirecting, setIsRedirecting] = useState(false);

  const signIn = (provider: IdentityProvider | undefined) => {
    setIsRedirecting(true);
    void signInToContinue(
      { step: 'accept', token, provider, signIns: 0 },
      {
        locale: language,
        // A provider creates the Keycloak user of a new account only from an invitation.
        isInvitation: invitation.accountState === 'invited',
        ...(provider === undefined ? { loginHint: invitation.email } : {}),
      },
    );
  };

  if (isRedirecting) {
    return (
      <p role="status" className="text-muted-foreground">
        {t('redirecting')}
      </p>
    );
  }
  if (invitation.accountState === 'active') {
    // A further link of an existing account: only its own session accepts it (§7.4).
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t('activeIntro')}</p>
        <Button className="w-full md:w-fit" onClick={() => signIn(undefined)}>
          {t('signInToAccept')}
        </Button>
      </div>
    );
  }
  if (invitation.kind === 'team') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground">{t('teamIntro')}</p>
        <ProviderButton provider="github" onClick={() => signIn('github')} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <PasswordAcceptanceForm
        token={token}
        email={invitation.email}
        language={language}
        onTokenRejected={onTokenRejected}
      />
      {endUserProviders.length > 0 && (
        <>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Separator className="flex-1" />
            {t('or')}
            <Separator className="flex-1" />
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            {endUserProviders.map((provider) => (
              <ProviderButton key={provider} provider={provider} onClick={() => signIn(provider)} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ProviderButton({
  provider,
  onClick,
}: {
  provider: IdentityProvider;
  onClick: () => void;
}) {
  const t = useTranslations('invitations.acceptance');
  return (
    <Button variant="outline" className="w-full md:w-fit" onClick={onClick}>
      {t('continueWith', { provider: PROVIDER_NAMES[provider] })}
    </Button>
  );
}
