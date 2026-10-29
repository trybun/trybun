'use client';

import { languageSchema } from '@trybun/contracts/users';
import { useLocale, useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import type { IdentityProvider } from '../../sessions/keycloak-sign-in.js';
import { invitationTokenOf, readPendingAcceptance } from '../acceptance-state.js';
import { ContinueAcceptance } from './continue-acceptance.js';
import { InvitationMessage } from './invitation-message.js';
import { InvitationOffer } from './invitation-offer.js';

/** The fragment of the address is known only in the browser; the server renders the check. */
function useLocationHash(): string | undefined {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    },
    () => window.location.hash,
    () => undefined,
  );
}

/**
 * The acceptance page of an invitation (ADR 0009): a link opened with its token in the fragment
 * shows the invitation and the ways to accept it; back from a sign-in started here, the step kept
 * in the tab's `sessionStorage` continues the acceptance. Without either, the link is invalid.
 */
export function InvitationAcceptance({
  endUserProviders,
}: {
  /** The configured Microsoft and Google sign-ins of end users. */
  endUserProviders: readonly IdentityProvider[];
}) {
  const t = useTranslations('invitations.acceptance');
  const language = languageSchema.parse(useLocale());
  const hash = useLocationHash();
  if (hash === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        {t('checking')}
      </p>
    );
  }
  const token = invitationTokenOf(hash);
  if (token !== undefined) {
    return (
      <InvitationOffer
        key={token}
        token={token}
        language={language}
        endUserProviders={endUserProviders}
      />
    );
  }
  const pending = readPendingAcceptance(window.sessionStorage);
  if (pending !== undefined) {
    return <ContinueAcceptance pending={pending} language={language} />;
  }
  return <InvitationMessage title={t('invalidTitle')}>{t('noToken')}</InvitationMessage>;
}
