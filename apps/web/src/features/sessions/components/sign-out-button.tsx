'use client';

import { Button } from '@trybun/ui/components/button';

/** Ends the web session and the Keycloak session, then returns to the start page. */
export function SignOutButton({ label }: { label: string }) {
  return (
    <Button
      onClick={() => {
        void import('next-auth/react').then(({ signOut }) => signOut({ callbackUrl: '/' }));
      }}
    >
      {label}
    </Button>
  );
}
