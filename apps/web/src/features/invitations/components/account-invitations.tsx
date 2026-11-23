'use client';

import { useQuery } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import type { User } from '@trybun/contracts/users';
import { Button } from '@trybun/ui/components/button';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { QueryErrorAlert } from '../../app-shell/components/query-error-alert.js';
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
 * none: deactivating revokes them. A failed read shows its error with **Try again** in place of
 * the invitations (#471), which never just disappear. Nothing is rendered – not even `wrap` –
 * while there is nothing to show.
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
  const errorMessage = useErrorMessage();
  const isInvitable = user.state === 'invited' || user.state === 'active';
  const hasInvitations = hasPendingInvitations(user);
  const invitations = useQuery({
    ...accountsInvitationsQueryOptions(browserApiClient, pageAccounts),
    enabled: hasInvitations,
    select: (items) => items.filter((invitation) => invitation.user.id === user.id),
  });
  const items = invitations.data ?? [];

  const targetOf = ({ target }: Invitation) =>
    target.type === 'project'
      ? t('targets.project', { name: target.project.name, role: t(`roles.${target.role}`) })
      : target.type === 'organization'
        ? t('targets.organization', { name: target.organization.name })
        : t('targets.administrator');

  if (isInvitable && hasInvitations && invitations.isError) {
    // A refusal says when to try again, `h3` under the `h2` of the page like the errors of the list;
    // **Try again** reads the invitations of the page again, so it offers no **Reload page**, which
    // would drop the accounts loaded with **Load more** (§18.5).
    return wrap(
      <div className="flex flex-col items-start gap-2">
        <QueryErrorAlert
          error={invitations.error}
          message={errorMessage(invitations.error)}
          headingLevel={3}
          offersReload={false}
        />
        <Button type="button" variant="outline" onClick={() => void invitations.refetch()}>
          {t('pending.retry')}
        </Button>
      </div>,
    );
  }
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
