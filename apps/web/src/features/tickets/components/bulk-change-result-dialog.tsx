'use client';

import type { BulkChangeResult, TicketListItem } from '@trybun/contracts/tickets';
import { Button } from '@trybun/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@trybun/ui/components/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@trybun/ui/components/drawer';
import { TABLET_MEDIA_QUERY, useMediaQuery } from '@trybun/ui/hooks/use-media-query';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';

/** A ticket a bulk change did not change, with the result that says why. */
export interface UnchangedTicket {
  ticket: Pick<TicketListItem, 'id' | 'identifier' | 'title'>;
  result: Exclude<BulkChangeResult, { status: 200 }>;
}

/** The reason of a result as the dialog names it (§8.1, S1-13 Q1). */
function useReason() {
  const t = useTranslations('tickets.list.bulk.reasons');
  const errorMessage = useErrorMessage();
  return ({ status, code }: UnchangedTicket['result']) => {
    if (code === 'project.archived') {
      return t('archived');
    }
    if (status === 412 || status === 403 || status === 404) {
      return t(String(status) as '412' | '403' | '404');
    }
    return errorMessage(code);
  };
}

/**
 * The result of a bulk change that did not change every ticket (§8.1): "19 of 20 tickets
 * updated" and each unchanged ticket with its identifier, title and reason. **Reload and retry**
 * reads the list again and repeats the change on them – a dialog from the tablet width on, a
 * bottom sheet on phones. Open while it is rendered.
 */
export function BulkChangeResultDialog({
  changed,
  total,
  unchanged,
  left,
  isRetrying,
  onRetry,
  onClose,
}: {
  changed: number;
  total: number;
  unchanged: UnchangedTicket[];
  /** How many selected tickets a retry dropped, as they left the list. */
  left: number;
  isRetrying: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('tickets.list.bulk');
  const reasonOf = useReason();
  const isSheet = !useMediaQuery(TABLET_MEDIA_QUERY);
  const onOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };
  const title = t('resultTitle', { changed, total });
  const body: ReactNode = (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      {left > 0 && <p className="text-sm">{t('left', { count: left })}</p>}
      <ul className="flex flex-col gap-2">
        {unchanged.map(({ ticket, result }) => (
          <li key={ticket.id} className="flex flex-col rounded-md border border-border p-2 text-sm">
            <span>
              <span className="font-mono">{ticket.identifier}</span> {ticket.title}
            </span>
            <span className="text-muted-foreground">{reasonOf(result)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
  const actions = (
    <>
      <Button type="button" variant="outline" onClick={onClose}>
        {t('close')}
      </Button>
      <Button type="button" disabled={isRetrying} onClick={onRetry}>
        {t('retry')}
      </Button>
    </>
  );
  if (isSheet) {
    return (
      <Drawer defaultOpen onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{t('resultDescription')}</DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-col px-4">{body}</div>
          <DrawerFooter>{actions}</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <Dialog defaultOpen onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t('resultDescription')}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
