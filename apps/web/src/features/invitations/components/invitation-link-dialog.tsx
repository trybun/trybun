'use client';

import { Button } from '@trybun/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@trybun/ui/components/dialog';
import { InvitationLink } from './invitation-link.js';

/** The link of a resent invitation, shown once in a dialog open while it is rendered (§7.4). */
export function InvitationLinkDialog({
  title,
  description,
  closeLabel,
  link,
  expiresAt,
  onClose,
}: {
  title: string;
  description: string;
  closeLabel: string;
  link: string;
  expiresAt: string;
  onClose: () => void;
}) {
  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <InvitationLink link={link} expiresAt={expiresAt} />
        <DialogFooter>
          <DialogClose render={<Button />}>{closeLabel}</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
