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
import type { ReactNode, RefObject } from 'react';

/**
 * A confirmation of a change that cannot be undone with Undo – removing a member, demoting the last
 * Project manager (§7.4) or deleting a project – open while it is rendered.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  isDestructive = false,
  isPending = false,
  isConfirmDisabled = false,
  children,
  finalFocus,
  onConfirm,
  onClose,
}: {
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  isDestructive?: boolean;
  isPending?: boolean;
  isConfirmDisabled?: boolean;
  /** Further content, e.g. the field of a typed confirmation. */
  children?: ReactNode;
  /**
   * Where the focus goes when the dialog closes, when its trigger may be gone by then (e.g. the
   * Delete button of a deleted item); by default it returns to the trigger.
   */
  finalFocus?: RefObject<HTMLElement | null>;
  onConfirm: () => void;
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
      <DialogContent {...(finalFocus === undefined ? {} : { finalFocus })}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description !== undefined && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>{cancelLabel}</DialogClose>
          <Button
            variant={isDestructive ? 'destructive' : 'default'}
            disabled={isPending || isConfirmDisabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
