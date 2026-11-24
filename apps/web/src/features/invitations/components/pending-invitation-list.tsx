'use client';

import { INVITATION_VALIDITY_DAYS, type Invitation } from '@trybun/contracts/invitations';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { ApiError } from '../../../lib/errors/api-error.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { QueryErrorAlert } from '../../app-shell/components/query-error-alert.js';
import type { RateLimitedHeadingLevel } from '../../app-shell/components/rate-limited-message.js';
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
 * Whether the API refused an action that no retry can make succeed: the invitation is no longer
 * pending (§7.4) – accepted or revoked by someone else – or no longer visible (`404`, §17.2).
 */
function isNoLongerActionable(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'invitation.not_pending' || error.code === 'request.not_found')
  );
}

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
  paging,
  'aria-label': ariaLabel,
}: {
  invitations: Invitation[];
  /** The first line of an invitation, e.g. its address or its target. */
  titleOf: (invitation: Invitation) => string;
  /** What precedes the inviting person, e.g. the role. */
  detailOf?: (invitation: Invitation) => string | undefined;
  /** The invitation in the names of its buttons, unique in the list; its address by default. */
  nameOf?: (invitation: Invitation) => string;
  /**
   * The next page of a list read page by page, e.g. a project's; none when all are shown. `error`
   * is the failure of a later page, shown above **Load more** while the loaded invitations stay
   * (#434); `headingLevel` is the level of the heading of its refusal with `429`, continuing the
   * page around the list (#433).
   */
  paging?: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    error: Error | null;
    headingLevel: RateLimitedHeadingLevel;
    onLoadMore: () => void;
  };
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
    // Closes the confirmation of this invitation, not one opened for another while it was sent.
    const close = () =>
      setPending((current) => (current?.invitation.id === invitation.id ? null : current));
    // A refusal no retry can overcome closes the confirmation, the list then refreshing without the
    // invitation; any other error keeps it open to try again. The message is shown either way.
    const refuse = (error: unknown) => {
      if (isNoLongerActionable(error)) {
        close();
      }
      showError(error);
    };
    // Not the callbacks of `mutate`: they never run for an unmounted component, and the refreshed
    // list removes this one when the invitation was the last – revoked, or refused as no longer
    // pending – of an account (`pendingInvitationCount` becomes 0) or of a project.
    if (kind === 'resend') {
      resend.mutateAsync(invitation.id).then((resent) => {
        close();
        setNewLink({
          email: emailOf(invitation),
          link: resent.link,
          expiresAt: resent.invitation.expiresAt,
        });
      }, refuse);
      return;
    }
    revoke.mutateAsync(invitation.id).then(() => {
      close();
      toast.add({ title: t('revoked'), type: 'success' });
    }, refuse);
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
      {paging !== undefined && paging.error !== null && !paging.isFetchingNextPage && (
        <QueryErrorAlert
          error={paging.error}
          message={errorMessage(paging.error)}
          headingLevel={paging.headingLevel}
          offersReload={false}
        />
      )}
      {paging?.hasNextPage === true && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={paging.isFetchingNextPage}
          onClick={paging.onLoadMore}
        >
          {paging.isFetchingNextPage ? t('loadingMore') : t('loadMore')}
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
