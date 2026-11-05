'use client';

import { Button } from '@trybun/ui/components/button';
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@trybun/ui/components/dialog';
import { useTranslations } from 'next-intl';
import type { IssuedInvitation } from './invitation-form.js';
import { InvitationLink } from './invitation-link.js';

/**
 * The step of an inviting dialog after an invitation was created (§7.4): its link with Copy link,
 * shown only now, and Done.
 */
export function InvitationIssued({ invitation }: { invitation: IssuedInvitation }) {
  const t = useTranslations('invitations.issued');
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{t('title')}</DialogTitle>
        <DialogDescription>{t('description', { email: invitation.email })}</DialogDescription>
      </DialogHeader>
      <InvitationLink link={invitation.link} expiresAt={invitation.expiresAt} />
      <DialogFooter>
        <DialogClose render={<Button type="button" />}>{t('done')}</DialogClose>
      </DialogFooter>
    </div>
  );
}
