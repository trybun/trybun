'use client';

import type { UserKind } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import { UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { lazy, Suspense } from 'react';

// The dialog opens only on request, so its code loads after the first paint (§18.5); the server
// renders its button. The fallback is the same button: React drops the server HTML of a boundary
// that receives an update before its code has loaded, and without it the button vanished while the
// page hydrated, moving the list below it under the finger (#308).
const InviteDialog = lazy(() =>
  import('./invite-dialog.js').then((module) => ({ default: module.InviteDialog })),
);

/** The Invite button and dialog of the Accounts page, loaded after the first paint. */
export function LazyInviteDialog({ email, kind }: { email?: string; kind?: UserKind }) {
  const t = useTranslations('invitations.invite');
  return (
    <Suspense
      fallback={
        <Button
          variant={email === undefined ? 'default' : 'outline'}
          className="w-full md:w-fit"
          aria-label={email === undefined ? undefined : t('openFor', { email })}
        >
          <UserPlusIcon aria-hidden />
          {t('open')}
        </Button>
      }
    >
      <InviteDialog email={email} kind={kind} />
    </Suspense>
  );
}
