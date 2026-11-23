'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useLocationHash } from '../../../lib/browser/use-location-hash.js';
import { ApiError, isRateLimited } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { QueryErrorAlert } from '../../app-shell/components/query-error-alert.js';
import { RateLimitedAlert } from '../../app-shell/components/rate-limited-alert.js';
import { setupQueryOptions, setupTokenVerificationQueryOptions } from '../queries.js';
import { setupTokenOf } from '../setup-link.js';
import { AdministratorForm } from './administrator-form.js';
import { SetupMessage } from './setup-message.js';

/** The token of the setup link, in the fragment of the address; `undefined` on the server. */
function useSetupToken(): string | undefined {
  const hash = useLocationHash();
  return hash === undefined ? undefined : setupTokenOf(hash);
}

/**
 * The first-run wizard (§15.6): checks the token of the setup link, then shows the one-step form
 * that creates the first Administrator; a used, expired or unknown token, or a system that is set
 * up, gets its message instead. Its own creation completes the setup too, so the success message
 * wins over the completed status until the page is reloaded.
 */
export function SetupWizard() {
  const t = useTranslations('setup');
  const errorMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const token = useSetupToken();
  const [isCreated, setIsCreated] = useState(false);
  const setup = useQuery(setupQueryOptions(browserApiClient));
  const verification = useQuery({
    ...setupTokenVerificationQueryOptions(browserApiClient, token ?? ''),
    enabled: token !== undefined && token !== '' && setup.data?.status === 'available',
  });

  if (isCreated) {
    return (
      <SetupMessage title={t('doneTitle')} signIn>
        {t('doneText')}
      </SetupMessage>
    );
  }
  const isCompleted =
    setup.data?.status === 'completed' ||
    (verification.error instanceof ApiError && verification.error.code === 'setup.completed');
  if (isCompleted) {
    return <SetupMessage title={t('completedTitle')} signIn />;
  }
  if (setup.isError) {
    // Without the status the token is never checked: the failure is shown instead of the check
    // (#433), a refusal with the wait – the status and the check share one limit (§14.4).
    return (
      <QueryErrorAlert error={setup.error} message={errorMessage(setup.error)} headingLevel={2} />
    );
  }
  if (isRateLimited(verification.error)) {
    // Only a temporary limit, never an invalid link (#433); `h2` under the `h1` of the page, as
    // the setup messages. **Reload page** keeps the token in the fragment of the address.
    return <RateLimitedAlert error={verification.error} headingLevel={2} />;
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
      onCreated={() => setIsCreated(true)}
      onTokenRejected={() => void queryClient.invalidateQueries({ queryKey: ['setup'] })}
    />
  );
}
