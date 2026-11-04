'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import type { User } from '@trybun/contracts/users';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { userInvitationsQueryOptions } from '../queries.js';
import { LazyInviteDialog } from './lazy-invite-dialog.js';
import { PendingInvitationList } from './pending-invitation-list.js';

/**
 * The pending invitations of an account on the Accounts page (§7.4): target, inviting person and
 * expiry, with **Copy new link** and **Revoke** where allowed. They are fetched only for an account
 * whose `pendingInvitationCount` says it has some, so the page does not ask for every row. An
 * `invited` account without one – reactivated, or all its invitations expired or revoked – has no
 * working link, so **Invite** is offered for its address right away. Deactivated accounts have
 * none: deactivating revokes them. Nothing is rendered – not even `wrap` – while there is nothing
 * to show.
 */
export function AccountInvitations({
  user,
  wrap,
}: {
  user: User;
  /** The element of the list layout around the content, e.g. a row of the table. */
  wrap: (content: ReactNode) => ReactNode;
}) {
  const t = useTranslations('invitations');
  const isInvitable = user.state === 'invited' || user.state === 'active';
  const hasInvitations = isInvitable && user.pendingInvitationCount > 0;
  const invitations = useInfiniteQuery({
    ...userInvitationsQueryOptions(browserApiClient, user.id),
    enabled: hasInvitations,
  });
  const items = invitations.data?.pages.flatMap((page) => page.items) ?? [];

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
        hasNextPage={invitations.hasNextPage}
        isFetchingNextPage={invitations.isFetchingNextPage}
        onLoadMore={() => void invitations.fetchNextPage()}
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
