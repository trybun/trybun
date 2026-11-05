'use client';

import { INVITATION_VALIDITY_DAYS, type Invitation } from '@trybun/contracts/invitations';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { LazyConfirmDialog } from '../../projects/components/lazy-confirm-dialog.js';
import { useResendInvitation, useRevokeInvitation } from '../mutations.js';
import type { IssuedInvitation } from './invitation-form.js';

// The new link opens only after a resending, so its dialog code loads then (§18.5).
const InvitationLinkDialog = lazy(() =>
  import('./invitation-link-dialog.js').then((module) => ({
    default: module.InvitationLinkDialog,
  })),
);

/** An action on an invitation that needs a confirmation first. */
type PendingAction = { kind: 'resend' | 'revoke'; invitation: Invitation };

/**
 * Pending invitations (§7.4) – of a project in its Members tab, of an account on the Accounts page
 * – each with its title, the inviting person and the expiry, with **Copy new link** – a resending
 * after a confirmation that the old link stops working, then the new link – and **Revoke**, each
 * only when the invitation's `allowedActions` list it.
 */
export function PendingInvitationList({
  invitations,
  titleOf,
  detailOf,
  nameOf,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
  'aria-label': ariaLabel,
}: {
  invitations: Invitation[];
  /** The first line of an invitation, e.g. its address or its target. */
  titleOf: (invitation: Invitation) => string;
  /** What precedes the inviting person, e.g. the role. */
  detailOf?: (invitation: Invitation) => string | undefined;
  /** The invitation in the names of its buttons, unique in the list; its address by default. */
  nameOf?: (invitation: Invitation) => string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
  'aria-label'?: string;
}) {
  const t = useTranslations('invitations.pending');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [newLink, setNewLink] = useState<IssuedInvitation | null>(null);

  const emailOf = (invitation: Invitation) =>
    invitation.user.email ?? invitation.user.displayName ?? '';
  const accessibleNameOf = nameOf ?? emailOf;
  const invitedByOf = ({ invitedBy }: Invitation) =>
    invitedBy?.displayName === null || invitedBy === null
      ? t('invitedByUnknown')
      : t('invitedBy', { name: invitedBy.displayName });
  const showError = (error: unknown) => toast.add({ title: errorMessage(error), type: 'error' });

  const confirm = ({ kind, invitation }: PendingAction) => {
    if (kind === 'resend') {
      resend.mutate(invitation.id, {
        onSuccess: (resent) => {
          setPending(null);
          setNewLink({
            email: emailOf(invitation),
            link: resent.link,
            expiresAt: resent.invitation.expiresAt,
          });
        },
        onError: showError,
      });
      return;
    }
    // Not the callbacks of `mutate`: revoking the last invitation of an account removes this list
    // (`pendingInvitationCount` becomes 0), and they never run for an unmounted component.
    revoke.mutateAsync(invitation.id).then(() => {
      setPending(null);
      toast.add({ title: t('revoked'), type: 'success' });
    }, showError);
  };

  return (
    <>
      <ul aria-label={ariaLabel} className="flex flex-col gap-2">
        {invitations.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground md:flex-row md:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{titleOf(invitation)}</span>
              <span className="text-sm text-muted-foreground">
                {[detailOf?.(invitation), invitedByOf(invitation)]
                  .filter((part) => part !== undefined)
                  .join(' · ')}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('expires', {
                  date: format.dateTime(new Date(invitation.expiresAt), { dateStyle: 'medium' }),
                })}
              </span>
            </div>
            <div className="flex gap-2">
              {invitation.allowedActions.includes('resend') && (
                <Button
                  variant="outline"
                  className="flex-1 md:flex-none"
                  aria-label={t('copyNewLinkOf', { email: accessibleNameOf(invitation) })}
                  onClick={() => setPending({ kind: 'resend', invitation })}
                >
                  {t('copyNewLink')}
                </Button>
              )}
              {invitation.allowedActions.includes('revoke') && (
                <Button
                  variant="outline"
                  className="flex-1 md:flex-none"
                  aria-label={t('revokeOf', { email: accessibleNameOf(invitation) })}
                  onClick={() => setPending({ kind: 'revoke', invitation })}
                >
                  {t('revoke')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={isFetchingNextPage}
          onClick={onLoadMore}
        >
          {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </Button>
      )}
      {pending !== null && (
        <LazyConfirmDialog
          title={
            pending.kind === 'resend'
              ? t('resendTitle', { email: emailOf(pending.invitation) })
              : t('revokeTitle', { email: emailOf(pending.invitation) })
          }
          description={
            pending.kind === 'resend'
              ? t('resendDescription', { days: INVITATION_VALIDITY_DAYS })
              : t('revokeDescription')
          }
          confirmLabel={pending.kind === 'resend' ? t('resendConfirm') : t('revokeConfirm')}
          cancelLabel={t('cancel')}
          isDestructive={pending.kind === 'revoke'}
          isPending={resend.isPending || revoke.isPending}
          onConfirm={() => confirm(pending)}
          onClose={() => setPending(null)}
        />
      )}
      {newLink !== null && (
        <Suspense>
          <InvitationLinkDialog
            title={t('newLinkTitle')}
            description={t('newLinkDescription', { email: newLink.email })}
            closeLabel={t('close')}
            link={newLink.link}
            expiresAt={newLink.expiresAt}
            onClose={() => setNewLink(null)}
          />
        </Suspense>
      )}
    </>
  );
}
