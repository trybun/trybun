'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { Invitation } from '@trybun/contracts/invitations';
import { useTranslations } from 'next-intl';
import { browserApiClient } from '../../../lib/api-client/browser-api-client.js';
import { PendingInvitationList } from '../../invitations/components/pending-invitation-list.js';
import { projectInvitationsQueryOptions } from '../../invitations/queries.js';

/**
 * The pending invitations of a project in its Members tab (§7.4): address, role, inviting person
 * and expiry, with **Copy new link** and **Revoke** where allowed. Without pending invitations the
 * section is not shown.
 */
export function ProjectInvitations({ projectId }: { projectId: string }) {
  const t = useTranslations('invitations');
  const invitations = useInfiniteQuery(projectInvitationsQueryOptions(browserApiClient, projectId));

  const items = invitations.data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <section aria-labelledby="project-invitations-title" className="flex flex-col gap-4">
      <h3 id="project-invitations-title" className="text-base font-semibold">
        {t('pending.title')}
      </h3>
      <PendingInvitationList
        invitations={items}
        titleOf={(invitation) => invitation.user.email ?? ''}
        detailOf={({ target }: Invitation) =>
          target.type === 'project' ? t(`roles.${target.role}`) : undefined
        }
        hasNextPage={invitations.hasNextPage}
        isFetchingNextPage={invitations.isFetchingNextPage}
        onLoadMore={() => void invitations.fetchNextPage()}
      />
    </section>
  );
}
