'use client';

import type { UserKind } from '@trybun/contracts/users';
import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its code loads after the first paint (§18.5); the server
// renders its button.
const InviteDialog = lazy(() =>
  import('./invite-dialog.js').then((module) => ({ default: module.InviteDialog })),
);

/** The Invite button and dialog of the Accounts page, loaded after the first paint. */
export function LazyInviteDialog({ email, kind }: { email?: string; kind?: UserKind }) {
  return (
    <Suspense>
      <InviteDialog email={email} kind={kind} />
    </Suspense>
  );
}
