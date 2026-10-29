'use client';

import type { UserKind } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@trybun/ui/components/dialog';
import { toast } from '@trybun/ui/components/toast';
import { UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { InvitationForm, type IssuedInvitation } from './invitation-form.js';
import { InvitationIssued } from './invitation-issued.js';

/**
 * **Invite** of the Accounts page (§7.4): an e-mail address with any target – a project with a
 * role, an organization or the Administrator role – the preview of what sending will do, and after
 * an invitation its link with Copy link. For an existing `invited` account without a working
 * link (e.g. after a reactivation) the address is filled in and only the targets of its kind are
 * offered.
 */
export function InviteDialog({ email, kind }: { email?: string; kind?: UserKind }) {
  const t = useTranslations('invitations.invite');
  const [isOpen, setIsOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedInvitation | null>(null);
  // A new key per opening resets the form.
  const [opening, setOpening] = useState(0);

  const close = () => {
    setIsOpen(false);
    setIssued(null);
    setOpening((value) => value + 1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? setIsOpen(true) : close())}>
      {email === undefined ? (
        <DialogTrigger render={<Button className="w-full md:w-fit" />}>
          <UserPlusIcon aria-hidden />
          {t('open')}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={<Button variant="outline" className="w-full md:w-fit" />}
          aria-label={t('openFor', { email })}
        >
          <UserPlusIcon aria-hidden />
          {t('open')}
        </DialogTrigger>
      )}
      <DialogContent>
        {issued === null ? (
          <div className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>{t('title')}</DialogTitle>
              <DialogDescription>{t('description')}</DialogDescription>
            </DialogHeader>
            <InvitationForm
              key={opening}
              kind={kind}
              defaultEmail={email}
              onGranted={(name) => {
                toast.add({ title: t('granted', { name }), type: 'success' });
                close();
              }}
              onInvited={setIssued}
            />
          </div>
        ) : (
          <InvitationIssued invitation={issued} />
        )}
      </DialogContent>
    </Dialog>
  );
}
