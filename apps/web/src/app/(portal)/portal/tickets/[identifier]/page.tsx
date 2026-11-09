import { dehydrate, HydrationBoundary } from '@tanstack/react-query';
import { TicketView } from '../../../../../features/tickets/components/ticket-view.js';
import { getTicketPage } from '../../../../../features/tickets/ticket-page.js';
import { requireSession } from '../../../../../lib/auth/session.js';
import { getEnv } from '../../../../../lib/env/env.js';
import { getServerQueryClient } from '../../../../../lib/query-client/server-query-client.js';

/**
 * A ticket in the portal (§5.7): its public status, description, public timeline and comments
 * (S1-12).
 */
export default async function PortalTicketPage({
  params,
}: {
  params: Promise<{ identifier: string }>;
}) {
  const { identifier } = await params;
  await requireSession();
  await getTicketPage(identifier, 'portal');
  return (
    <HydrationBoundary state={dehydrate(getServerQueryClient())}>
      <TicketView identifier={identifier} attachmentMaxSizeMb={getEnv().attachmentMaxSizeMb} />
    </HydrationBoundary>
  );
}
