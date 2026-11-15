'use client';

import { useQuery } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import type { User } from '@trybun/contracts/users';
import { useTranslations } from 'next-intl';
import { type ReactNode, useCallback } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { accountsInvitationsQueryOptions, hasPendingInvitations } from '../queries.js';
import { LazyInviteDialog } from './lazy-invite-dialog.js';
import { PendingInvitationList } from './pending-invitation-list.js';

/**
 * The pending invitations of an account on the Accounts page (§7.4): target, inviting person and
 * expiry, with **Copy new link** and **Revoke** where allowed. They are read only for an account
 * whose `pendingInvitationCount` says it has some (`hasPendingInvitations`), with those of the other
 * accounts of its page in one query (`accountsInvitationsQueryOptions`, #357), loaded with the page
 * of accounts (`usersQueryOptions`) so the list never moves the rows below it (#310). An
 * `invited` account without one – reactivated, or all its invitations expired or revoked – has no
 * working link, so **Invite** is offered for its address right away. Deactivated accounts have
 * none: deactivating revokes them. Nothing is rendered – not even `wrap` – while there is nothing
 * to show.
 */
export function AccountInvitations({
  user,
  pageAccounts,
  wrap,
}: {
  user: User;
  /** The accounts of the page of accounts the account was loaded with, itself included. */
  pageAccounts: readonly User[];
  /** The element of the list layout around the content, e.g. a row of the table. */
  wrap: (content: ReactNode) => ReactNode;
}) {
  const t = useTranslations('invitations');
  const isInvitable = user.state === 'invited' || user.state === 'active';
  const hasInvitations = hasPendingInvitations(user);
  const ownInvitations = useCallback(
    (invitations: Invitation[]) =>
      invitations.filter((invitation) => invitation.user.id === user.id),
    [user.id],
  );
  const invitations = useQuery({
    ...accountsInvitationsQueryOptions(browserApiClient, pageAccounts),
    enabled: hasInvitations,
    select: ownInvitations,
  });
  const items = invitations.data ?? [];

  const targetOf = ({ target }: Invitation) =>
    target.type === 'project'
      ? t('targets.project', { name: target.project.name, role: t(`roles.${target.role}`) })
      : target.type === 'organization'
        ? t('targets.organization', { name: target.organization.name })
        : t('targets.administrator');

  if (!isInvitable || (hasInvitations && !invitations.isSuccess)) {
    return null;
  }
  if (items.length > 0) {
    return wrap(
      <PendingInvitationList
        aria-label={t('pending.listOf', { name: user.email ?? user.displayName ?? '' })}
        invitations={items}
        titleOf={targetOf}
        nameOf={(invitation) => `${invitation.user.email ?? ''}, ${targetOf(invitation)}`}
      />,
    );
  }
  if (user.state !== 'invited' || user.email === null) {
    return null;
  }
  return wrap(
    <div className="flex flex-col gap-2 md:flex-row md:items-center">
      <p className="text-sm text-muted-foreground md:flex-1">{t('invite.noLink')}</p>
      <LazyInviteDialog email={user.email} kind={user.kind} />
    </div>,
  );
}
