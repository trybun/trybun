'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { INVITATION_VALIDITY_DAYS, type Invitation } from '@trybun/contracts/invitations';
import { Button } from '@trybun/ui/components/button';
import { toast } from '@trybun/ui/components/toast';
import { useFormatter, useTranslations } from 'next-intl';
import { lazy, Suspense, useState } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { useResendInvitation, useRevokeInvitation } from '../../invitations/mutations.js';
import { projectInvitationsQueryOptions } from '../../invitations/queries.js';
import { LazyConfirmDialog } from './lazy-confirm-dialog.js';

// The new link opens only after a resending, so its dialog code loads then (§18.5).
const InvitationLinkDialog = lazy(() =>
  import('../../invitations/components/invitation-link-dialog.js').then((module) => ({
    default: module.InvitationLinkDialog,
  })),
);

/** An action on an invitation that needs a confirmation first. */
type PendingAction = { kind: 'resend' | 'revoke'; invitation: Invitation };

/** A new link, shown once after the resending (§7.4). */
type NewLink = { email: string; link: string; expiresAt: string };

/**
 * The pending invitations of a project in its Members tab (§7.4): address, role, inviting person
 * and expiry, with **Copy new link** – a resending after a confirmation that the old link stops
 * working – and **Revoke**, each only when the invitation's `allowedActions` list it. Without
 * pending invitations the section is not shown.
 */
export function ProjectInvitations({ projectId }: { projectId: string }) {
  const t = useTranslations('projects');
  const format = useFormatter();
  const errorMessage = useErrorMessage();
  const invitations = useInfiniteQuery(projectInvitationsQueryOptions(browserApiClient, projectId));
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [newLink, setNewLink] = useState<NewLink | null>(null);

  const emailOf = (invitation: Invitation) => invitation.user.email ?? t('members.noName');
  const invitedByOf = ({ invitedBy }: Invitation) =>
    invitedBy?.displayName === null || invitedBy === null
      ? t('invitations.invitedByUnknown')
      : t('invitations.invitedBy', { name: invitedBy.displayName });
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
    revoke.mutate(invitation.id, {
      onSuccess: () => {
        setPending(null);
        toast.add({ title: t('invitations.revoked'), type: 'success' });
      },
      onError: showError,
    });
  };

  const items = invitations.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="project-invitations-title" className="flex flex-col gap-4">
      <h3 id="project-invitations-title" className="text-base font-semibold">
        {t('invitations.title')}
      </h3>
      <ul className="flex flex-col gap-2">
        {items.map((invitation) => (
          <li
            key={invitation.id}
            className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 text-card-foreground md:flex-row md:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{emailOf(invitation)}</span>
              <span className="text-sm text-muted-foreground">
                {invitation.target.type === 'project' &&
                  `${t(`roles.${invitation.target.role}`)} · `}
                {invitedByOf(invitation)}
              </span>
              <span className="text-sm text-muted-foreground">
                {t('invitations.expires', {
                  date: format.dateTime(new Date(invitation.expiresAt), { dateStyle: 'medium' }),
                })}
              </span>
            </div>
            <div className="flex gap-2">
              {invitation.allowedActions.includes('resend') && (
                <Button
                  variant="outline"
                  className="flex-1 md:flex-none"
                  aria-label={t('invitations.copyNewLinkOf', { email: emailOf(invitation) })}
                  onClick={() => setPending({ kind: 'resend', invitation })}
                >
                  {t('invitations.copyNewLink')}
                </Button>
              )}
              {invitation.allowedActions.includes('revoke') && (
                <Button
                  variant="outline"
                  className="flex-1 md:flex-none"
                  aria-label={t('invitations.revokeOf', { email: emailOf(invitation) })}
                  onClick={() => setPending({ kind: 'revoke', invitation })}
                >
                  {t('invitations.revoke')}
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {invitations.hasNextPage && (
        <Button
          variant="outline"
          className="w-full md:w-fit"
          disabled={invitations.isFetchingNextPage}
          onClick={() => void invitations.fetchNextPage()}
        >
          {invitations.isFetchingNextPage ? t('list.loadingMore') : t('list.loadMore')}
        </Button>
      )}
      {pending !== null && (
        <LazyConfirmDialog
          title={
            pending.kind === 'resend'
              ? t('invitations.resendTitle', { email: emailOf(pending.invitation) })
              : t('invitations.revokeTitle', { email: emailOf(pending.invitation) })
          }
          description={
            pending.kind === 'resend'
              ? t('invitations.resendDescription', { days: INVITATION_VALIDITY_DAYS })
              : t('invitations.revokeDescription')
          }
          confirmLabel={
            pending.kind === 'resend'
              ? t('invitations.resendConfirm')
              : t('invitations.revokeConfirm')
          }
          cancelLabel={t('invitations.cancel')}
          isDestructive={pending.kind === 'revoke'}
          isPending={resend.isPending || revoke.isPending}
          onConfirm={() => confirm(pending)}
          onClose={() => setPending(null)}
        />
      )}
      {newLink !== null && (
        <Suspense>
          <InvitationLinkDialog
            title={t('invitations.newLinkTitle')}
            description={t('invitations.newLinkDescription', { email: newLink.email })}
            closeLabel={t('invitations.close')}
            link={newLink.link}
            expiresAt={newLink.expiresAt}
            onClose={() => setNewLink(null)}
          />
        </Suspense>
      )}
    </section>
  );
}
