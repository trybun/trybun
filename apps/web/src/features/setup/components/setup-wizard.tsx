'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { setupQueryOptions, setupTokenVerificationQueryOptions } from '../queries.js';
import { setupTokenOf } from '../setup-link.js';
import { AdministratorForm } from './administrator-form.js';
import { SetupMessage } from './setup-message.js';

/** The fragment of the address is known only in the browser; the server renders the check. */
function useSetupToken(): string | undefined {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('hashchange', onChange);
      return () => window.removeEventListener('hashchange', onChange);
    },
    () => setupTokenOf(window.location.hash),
    () => undefined,
  );
}

/**
 * The first-run wizard (§15.6): checks the token of the setup link, then shows the one-step form
 * that creates the first Administrator; a used, expired or unknown token, or a system that is set
 * up, gets its message instead.
 */
export function SetupWizard() {
  const t = useTranslations('setup');
  const queryClient = useQueryClient();
  const token = useSetupToken();
  const setup = useQuery(setupQueryOptions(browserApiClient));
  const verification = useQuery({
    ...setupTokenVerificationQueryOptions(browserApiClient, token ?? ''),
    enabled: token !== undefined && token !== '' && setup.data?.status === 'available',
  });

  const isCompleted =
    setup.data?.status === 'completed' ||
    (verification.error instanceof ApiError && verification.error.code === 'setup.completed');
  if (isCompleted) {
    return <SetupMessage title={t('completedTitle')} signIn />;
  }
  if (token === '' || verification.isError) {
    return (
      <SetupMessage title={t('invalidTitle')}>
        {t.rich('invalidText', {
          command: (chunks) => <code className="font-mono text-foreground">{chunks}</code>,
        })}
      </SetupMessage>
    );
  }
  if (verification.data === undefined || token === undefined) {
    return (
      <p role="status" className="text-muted-foreground">
        {t('checking')}
      </p>
    );
  }
  return (
    <AdministratorForm
      token={token}
      setup={verification.data}
      onTokenRejected={() => void queryClient.invalidateQueries({ queryKey: ['setup'] })}
    />
  );
}
