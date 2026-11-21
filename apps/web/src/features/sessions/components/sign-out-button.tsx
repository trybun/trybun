'use client';

import { Button } from '@trybun/ui/components/button';
import type { ComponentProps } from 'react';

/**
 * Ends the web session and the Keycloak session, then returns to the start page. The main button
 * by default; `outline` where signing out is a secondary action, e.g. beside **Reload page** over
 * the rate limit (#384).
 */
export function SignOutButton({
  label,
  variant,
}: {
  label: string;
  variant?: ComponentProps<typeof Button>['variant'];
}) {
  return (
    <Button
      variant={variant}
      onClick={() => {
        void import('next-auth/react').then(({ signOut }) => signOut({ callbackUrl: '/' }));
      }}
    >
      {label}
    </Button>
  );
}
