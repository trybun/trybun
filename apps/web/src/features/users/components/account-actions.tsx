'use client';

import type { User } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@trybun/ui/components/dropdown-menu';
import { toast } from '@trybun/ui/components/toast';
import { EllipsisVerticalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { type AccountChange, useChangeAccount } from '../mutations.js';

/** The label of each change in the menu and the message after it. */
const CHANGES = {
  deactivate: { label: 'deactivate', done: 'deactivated' },
  reactivate: { label: 'reactivate', done: 'reactivated' },
  grant_admin: { label: 'grantAdmin', done: 'adminGranted' },
  revoke_admin: { label: 'revokeAdmin', done: 'adminRevoked' },
} as const satisfies Record<AccountChange, { label: string; done: string }>;

/** The changes that take effect at once and cannot be undone, so they are confirmed first. */
type ConfirmedChange = Extract<AccountChange, 'deactivate' | 'revoke_admin'>;

/**
 * The actions of an account on the Accounts page (§7.4): only those its `allowedActions` list.
 * Deactivating – which ends every session at once – and revoking the Administrator role are
 * confirmed with their effects; reactivating and granting the role take effect directly.
 */
export function AccountActions({ user, name }: { user: User; name: string }) {
  const t = useTranslations('users.accounts');
  const errorMessage = useErrorMessage();
  const changeAccount = useChangeAccount();
  const [confirming, setConfirming] = useState<ConfirmedChange | null>(null);

  if (user.allowedActions.length === 0) {
    return null;
  }
  const apply = (change: AccountChange) =>
    changeAccount.mutate(
      { change, userId: user.id },
      {
        onSuccess: () => {
          setConfirming(null);
          toast.add({ title: t(CHANGES[change].done, { name }), type: 'success' });
        },
        onError: (error) => {
          setConfirming(null);
          toast.add({ title: errorMessage(error), type: 'error' });
        },
      },
    );
  const request = (change: AccountChange) => {
    if (change === 'deactivate' || change === 'revoke_admin') {
      setConfirming(change);
      return;
    }
    apply(change);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="icon" />}
          aria-label={t('actionsOf', { name })}
          disabled={changeAccount.isPending}
        >
          <EllipsisVerticalIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {user.allowedActions.map((action) => (
            <DropdownMenuItem
              key={action}
              variant={action === 'deactivate' ? 'destructive' : 'default'}
              onClick={() => request(action)}
            >
              {t(CHANGES[action].label)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming !== null && (
        <LazyConfirmDialog
          title={
            confirming === 'deactivate'
              ? t('deactivateTitle', { name })
              : t('revokeAdminTitle', { name })
          }
          description={
            confirming === 'deactivate' ? t('deactivateDescription') : t('revokeAdminDescription')
          }
          confirmLabel={
            confirming === 'deactivate'
              ? changeAccount.isPending
                ? t('deactivating')
                : t('deactivateConfirm')
              : t('revokeAdminConfirm')
          }
          cancelLabel={t('cancel')}
          isDestructive
          isPending={changeAccount.isPending}
          onConfirm={() => apply(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </>
  );
}
