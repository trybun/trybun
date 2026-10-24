'use client';

import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect } from 'react';

/**
 * Starts the sign-in with Keycloak at once, so the user sees the Keycloak login screen in the
 * language of the web application without an extra step (Rule 2, §13.1). Auth.js requires the
 * sign-in to start with a POST from the browser (CSRF token).
 */
export function SignInRedirect({ callbackUrl }: { callbackUrl: string }) {
  const t = useTranslations('signIn');
  const locale = useLocale();
  useEffect(() => {
    void signIn('keycloak', { callbackUrl }, { ui_locales: locale });
  }, [callbackUrl, locale]);
  return <p role="status">{t('redirecting')}</p>;
}
