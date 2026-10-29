'use client';

import { useQuery } from '@tanstack/react-query';
import type { Language } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { signOutInPlace } from '../../sessions/keycloak-sign-in.js';
import { currentUserQueryOptions } from '../../users/queries.js';
import { signInToContinue } from '../acceptance-sign-in.js';
import {
  acceptancePathOf,
  browserTimeZone,
  clearPendingAcceptance,
  MAX_SECOND_FACTOR_SIGN_INS,
  type PendingAcceptance,
  writePendingAcceptance,
} from '../acceptance-state.js';
import { useAcceptInvitation } from '../mutations.js';
import { InvitationMessage } from './invitation-message.js';

/** Leaves the page for the landing path once the acceptance has ended. */
function land(landingPath: string) {
  clearPendingAcceptance(window.sessionStorage);
  window.location.assign(landingPath);
}

/**
 * The acceptance after a sign-in started from the link (ADR 0009): back on the page, it accepts
 * with the new session; for a team member it then checks that the session has the second factor,
 * signing in again until Keycloak has asked for a one-time code, and opens the landing path.
 */
export function ContinueAcceptance({
  pending,
  language,
}: {
  pending: PendingAcceptance;
  language: Language;
}) {
  return pending.step === 'accept' ? (
    <AcceptWithSession pending={pending} language={language} />
  ) : (
    <VerifySecondFactor pending={pending} language={language} />
  );
}

/** Starts the next sign-in for the second factor, or `false` when the page gives up. */
function signInForSecondFactor(pending: PendingAcceptance, language: Language): boolean {
  if (pending.signIns >= MAX_SECOND_FACTOR_SIGN_INS) {
    return false;
  }
  void signInToContinue({ ...pending, signIns: pending.signIns + 1 }, { locale: language });
  return true;
}

function AcceptWithSession({
  pending,
  language,
}: {
  pending: Extract<PendingAcceptance, { step: 'accept' }>;
  language: Language;
}) {
  const t = useTranslations('invitations.acceptance');
  const errorMessage = useErrorMessage();
  const accept = useAcceptInvitation();
  const { mutate } = accept;
  // One acceptance per page load: the token is single-use (ADR 0009).
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    mutate(
      {
        method: 'identity_provider',
        token: pending.token,
        language,
        timeZone: browserTimeZone(),
      },
      {
        onSuccess: ({ kind, landingPath }) => {
          if (kind === 'end_user') {
            land(landingPath);
            return;
          }
          // A team member: the team actions need a session with the second factor.
          const verify: PendingAcceptance = {
            step: 'verify',
            landingPath,
            provider: pending.provider,
            signIns: 0,
          };
          writePendingAcceptance(window.sessionStorage, verify);
          window.location.reload();
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'authentication.second_factor_required') {
            signInForSecondFactor(pending, language);
            return;
          }
          if (!(error instanceof ApiError) || error.code !== 'invitation.account_mismatch') {
            clearPendingAcceptance(window.sessionStorage);
          }
        },
      },
    );
  }, [mutate, pending, language]);

  const reopen = () => {
    clearPendingAcceptance(window.sessionStorage);
    window.location.replace(acceptancePathOf(pending.token));
  };

  if (accept.error instanceof ApiError) {
    const { code } = accept.error;
    if (code === 'invitation.token_invalid') {
      return (
        <InvitationMessage title={t('invalidTitle')}>
          {errorMessage(accept.error)}
        </InvitationMessage>
      );
    }
    if (code === 'invitation.account_mismatch') {
      return (
        <InvitationMessage
          title={t('mismatchTitle')}
          action={
            <Button className="w-full md:w-fit" onClick={() => void signOutInPlace().then(reopen)}>
              {t('signOut')}
            </Button>
          }
        >
          {errorMessage(accept.error)}
        </InvitationMessage>
      );
    }
    if (
      code === 'authentication.second_factor_required' &&
      pending.signIns < MAX_SECOND_FACTOR_SIGN_INS
    ) {
      return <Status text={t('secondFactor')} />;
    }
  }
  if (accept.isError) {
    return (
      <InvitationMessage
        title={t('failedTitle')}
        action={
          <Button className="w-full md:w-fit" onClick={reopen}>
            {t('retry')}
          </Button>
        }
      >
        {errorMessage(accept.error)}
      </InvitationMessage>
    );
  }
  return <Status text={t('accepting')} />;
}

function VerifySecondFactor({
  pending,
  language,
}: {
  pending: Extract<PendingAcceptance, { step: 'verify' }>;
  language: Language;
}) {
  const t = useTranslations('invitations.acceptance');
  const errorMessage = useErrorMessage();
  const user = useQuery({ ...currentUserQueryOptions(browserApiClient), retry: false });
  const isSecondFactorMissing =
    user.error instanceof ApiError && user.error.code === 'authentication.second_factor_required';
  const shouldSignIn = isSecondFactorMissing && pending.signIns < MAX_SECOND_FACTOR_SIGN_INS;

  useEffect(() => {
    if (user.isSuccess) {
      land(pending.landingPath);
    } else if (shouldSignIn) {
      signInForSecondFactor(pending, language);
    }
  }, [user.isSuccess, shouldSignIn, pending, language]);

  if (user.isError && !shouldSignIn) {
    return (
      <InvitationMessage
        title={t('failedTitle')}
        action={
          <Button
            className="w-full md:w-fit"
            onClick={() => signInForSecondFactor({ ...pending, signIns: 0 }, language)}
          >
            {t('signIn')}
          </Button>
        }
      >
        {errorMessage(user.error)}
      </InvitationMessage>
    );
  }
  return <Status text={shouldSignIn ? t('secondFactor') : t('accepting')} />;
}

function Status({ text }: { text: string }) {
  return (
    <p role="status" className="text-muted-foreground">
      {text}
    </p>
  );
}
