'use client';

import { signIn } from 'next-auth/react';
import { useEffect } from 'react';

/**
 * Starts the sign-in with Keycloak at once, so the user sees the translated Keycloak login screen
 * without an extra step (Rule 2). Auth.js requires the sign-in to start with a POST from the
 * browser (CSRF token).
 */
export function SignInRedirect({ callbackUrl }: { callbackUrl: string }) {
  useEffect(() => {
    void signIn('keycloak', { callbackUrl });
  }, [callbackUrl]);
  return null;
}
