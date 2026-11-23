'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { useErrorMessage } from '../../../lib/errors/error-message.js';
import { PendingInvitationList } from '../../invitations/components/pending-invitation-list.js';
import { projectInvitationsQueryOptions } from '../../invitations/queries.js';

/**
 * The pending invitations of a project in its Members tab (§7.4): address, role, inviting person
 * and expiry, with **Copy new link** and **Revoke** where allowed. Without pending invitations the
 * section is not shown; a failed read with nothing loaded shows its error under the heading (#437).
 */
export function ProjectInvitations({ projectId }: { projectId: string }) {
  const t = useTranslations('invitations');
  const errorMessage = useErrorMessage();
  const invitations = useInfiniteQuery(projectInvitationsQueryOptions(browserApiClient, projectId));

  const items = invitations.data?.pages.flatMap((page) => page.items) ?? [];
  // A failure replaces the list only when there is nothing to keep – the first read, or a refetch of
  // a project without pending invitations; a failed **Show more** keeps the invitations loaded
  // (#434). The heading stays, so the alert is not taken for one of the member list around it.
  const hasFailedWithNothingLoaded = invitations.isError && items.length === 0;
  if (items.length === 0 && !hasFailedWithNothingLoaded) {
    return null;
  }
  return (
    <section aria-labelledby="project-invitations-title" className="flex flex-col gap-4">
      <h3 id="project-invitations-title" className="text-base font-semibold">
        {t('pending.title')}
      </h3>
      {hasFailedWithNothingLoaded ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(invitations.error)}
        </p>
      ) : (
        <PendingInvitationList
          invitations={items}
          titleOf={(invitation) => invitation.user.email ?? ''}
          detailOf={({ target }: Invitation) =>
            target.type === 'project' ? t(`roles.${target.role}`) : undefined
          }
          paging={{
            hasNextPage: invitations.hasNextPage,
            isFetchingNextPage: invitations.isFetchingNextPage,
            error: invitations.error,
            onLoadMore: () => void invitations.fetchNextPage(),
          }}
        />
      )}
    </section>
  );
}
